-- Booking system, step 1: provider-controlled services, configurable commission and deadlines,
-- a full booking lifecycle, and overlap-safe scheduling.
--
-- No payments yet. While platform_settings.payments_enabled is 0 the app keeps working exactly as
-- before (provider confirms by hand). Nothing here marks anything as paid.

-- 1. Platform settings ------------------------------------------------------------------------

create table public.platform_settings (
  key text primary key,
  value numeric not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.platform_settings (key, value, note) values
  ('commission_percent', 10, 'Pebble commission taken from each provider price, in percent'),
  ('customer_fee_cents', 2500, 'Flat customer service fee per booking, in cents'),
  ('urgent_within_hours', 24, 'A booking starting within this many hours is urgent'),
  ('urgent_response_minutes', 30, 'How long a provider has to answer an urgent request'),
  ('future_response_hours', 24, 'How long a provider has to answer a request for a later date'),
  ('payment_window_minutes', 15, 'How long a customer has to pay once a booking awaits payment'),
  ('completion_confirm_hours', 24, 'How long a customer has to confirm or dispute a finished job'),
  ('max_pending_per_customer', 10, 'Most open requests one customer can hold at once'),
  ('payments_enabled', 0, '1 once a real payment gateway is connected. Never switch on without one'),
  ('gateway_ready', 0, 'Set by the database owner only, after a payment gateway is connected and tested');

alter table public.platform_settings enable row level security;

create policy "Admins read settings"
  on public.platform_settings for select to authenticated
  using ((select public.is_admin()));

grant select on public.platform_settings to authenticated;

create function public.setting(p_key text)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select value from public.platform_settings where key = p_key
$$;

revoke execute on function public.setting(text) from public, anon, authenticated;

-- What any signed-in or anonymous visitor may know: the commission and the windows.
create function public.public_booking_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from public.platform_settings
  where key in ('commission_percent', 'customer_fee_cents', 'urgent_response_minutes',
                'future_response_hours', 'payment_window_minutes', 'completion_confirm_hours',
                'payments_enabled')
$$;

revoke execute on function public.public_booking_settings() from public;
grant execute on function public.public_booking_settings() to anon, authenticated;

create function public.admin_set_setting(p_key text, p_value numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare lo numeric; hi numeric;
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  case p_key
    when 'commission_percent' then lo := 0; hi := 50;
    when 'customer_fee_cents' then lo := 0; hi := 10000;
    when 'urgent_within_hours' then lo := 1; hi := 72;
    when 'urgent_response_minutes' then lo := 5; hi := 240;
    when 'future_response_hours' then lo := 1; hi := 168;
    when 'payment_window_minutes' then lo := 5; hi := 120;
    when 'completion_confirm_hours' then lo := 1; hi := 168;
    when 'max_pending_per_customer' then lo := 1; hi := 50;
    when 'payments_enabled' then lo := 0; hi := 1;
    else raise exception 'Unknown setting';
  end case;
  if p_value < lo or p_value > hi then
    raise exception 'That value must be between % and %', lo, hi;
  end if;
  if p_key = 'payments_enabled' and p_value = 1 and public.setting('gateway_ready') is distinct from 1 then
    raise exception 'Payments cannot be switched on until a payment gateway is connected';
  end if;
  update public.platform_settings
     set value = p_value, updated_at = now(), updated_by = (select auth.uid())
   where key = p_key;
end;
$$;

revoke execute on function public.admin_set_setting(text, numeric) from public, anon;
grant execute on function public.admin_set_setting(text, numeric) to authenticated;

-- 2. Services: duration, active, instant booking ---------------------------------------------

alter table public.provider_services
  add column duration_minutes integer not null default 60 check (duration_minutes between 15 and 720),
  add column active boolean not null default true,
  add column instant_booking boolean not null default false;

grant insert (duration_minutes, active, instant_booking),
      update (duration_minutes, active, instant_booking)
  on public.provider_services to authenticated;

-- Deactivated services are not shown or bookable.
drop policy "Public reads services of live providers" on public.provider_services;
drop policy "Signed in reads services" on public.provider_services;
create policy "Public reads services of live providers"
  on public.provider_services for select to anon
  using (active and exists (select 1 from public.providers p where p.slug = provider_slug and p.active));
create policy "Signed in reads services"
  on public.provider_services for select to authenticated
  using (
    (active and exists (select 1 from public.providers p where p.slug = provider_slug and p.active))
    or provider_slug = (select public.current_provider_slug())
    or (select public.is_admin())
  );

-- 3. Provider scheduling preferences ----------------------------------------------------------

create table public.provider_booking_settings (
  provider_slug text primary key references public.providers (slug) on delete cascade,
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 240),
  max_daily_bookings integer check (max_daily_bookings between 1 and 50)
);

alter table public.provider_booking_settings enable row level security;

create policy "Providers read their booking settings"
  on public.provider_booking_settings for select to authenticated
  using (provider_slug = (select public.current_provider_slug()) or (select public.is_admin()));
create policy "Providers add their booking settings"
  on public.provider_booking_settings for insert to authenticated
  with check (provider_slug = (select public.current_provider_slug()));
create policy "Providers edit their booking settings"
  on public.provider_booking_settings for update to authenticated
  using (provider_slug = (select public.current_provider_slug()))
  with check (provider_slug = (select public.current_provider_slug()));

grant select on public.provider_booking_settings to authenticated;
grant insert (provider_slug, buffer_minutes, max_daily_bookings),
      update (buffer_minutes, max_daily_bookings)
  on public.provider_booking_settings to authenticated;

-- 4. Booking columns: duration, mode, deadline, money split, and separate payment tracking ----

alter table public.bookings
  add column duration_minutes integer not null default 60 check (duration_minutes between 15 and 720),
  add column booking_mode text not null default 'request' check (booking_mode in ('instant', 'request')),
  add column expires_at timestamptz,
  add column commission_pct numeric(5, 2) not null default 0,
  add column commission_cents integer not null default 0 check (commission_cents >= 0),
  add column earning_cents integer not null default 0 check (earning_cents >= 0),
  add column payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'authorised', 'paid', 'failed', 'refunded')),
  add column payout_status text not null default 'none'
    check (payout_status in ('none', 'held', 'eligible', 'on_hold', 'paid'));

-- Existing bookings predate commission: the provider keeps the full price.
update public.bookings set earning_cents = price_cents;

-- 5. Helpers ----------------------------------------------------------------------------------

create function public.time_mins(t time)
returns integer
language sql
immutable
as $$ select extract(hour from t)::integer * 60 + extract(minute from t)::integer $$;

-- Does a booking currently occupy its time? Open requests only count until their deadline.
create function public.booking_holds_slot(p_status public.booking_status, p_expires timestamptz)
returns boolean
language sql
stable
as $$
  select p_status in ('confirmed', 'in_progress', 'awaiting_confirmation', 'disputed')
      or (p_status in ('pending', 'awaiting_payment') and (p_expires is null or p_expires > now()))
$$;

-- Serialises bookings per provider, then refuses overlaps (with the provider's buffer) and a
-- full day. Callers hold the lock until their transaction ends, so two customers racing for the
-- same time cannot both succeed.
create function public.check_slot_free(p_slug text, p_date date, p_start time, p_dur integer, p_exclude uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  buf integer;
  cap integer;
  s integer := public.time_mins(p_start);
begin
  perform pg_advisory_xact_lock(hashtextextended('pebble-slot:' || p_slug, 0));
  select ps.buffer_minutes, ps.max_daily_bookings into buf, cap
    from public.provider_booking_settings ps where ps.provider_slug = p_slug;
  buf := coalesce(buf, 0);

  if cap is not null and (
       select count(*) from public.bookings b
       where b.provider_slug = p_slug and b.scheduled_date = p_date
         and b.id is distinct from p_exclude
         and public.booking_holds_slot(b.status, b.expires_at)) >= cap then
    raise exception using errcode = '23505',
      message = 'That day is fully booked (bookings_slot_unique)';
  end if;

  if exists (
    select 1 from public.bookings b
    where b.provider_slug = p_slug and b.scheduled_date = p_date
      and b.id is distinct from p_exclude
      and public.booking_holds_slot(b.status, b.expires_at)
      and s < public.time_mins(b.start_time) + b.duration_minutes + buf
      and public.time_mins(b.start_time) < s + p_dur + buf
  ) then
    raise exception using errcode = '23505',
      message = 'That time is no longer free (bookings_slot_unique)';
  end if;
end;
$$;

revoke execute on function public.check_slot_free(text, date, time, integer, uuid) from public, anon, authenticated;

-- When must the provider answer? Urgent jobs get a short window, later ones a longer one,
-- and never later than the appointment itself.
create function public.response_deadline(p_date date, p_start time)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select least(
    (p_date + p_start) at time zone 'Africa/Johannesburg',
    now() + case
      when (p_date + p_start) at time zone 'Africa/Johannesburg'
           < now() + make_interval(hours => public.setting('urgent_within_hours')::integer)
      then make_interval(mins => public.setting('urgent_response_minutes')::integer)
      else make_interval(hours => public.setting('future_response_hours')::integer)
    end)
$$;

revoke execute on function public.response_deadline(date, time) from public, anon, authenticated;

-- 6. Creating a booking: the database decides everything that matters -------------------------

create or replace function public.enforce_booking_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sa_now timestamp := now() at time zone 'Africa/Johannesburg';
  owner uuid;
  is_active boolean;
  svc public.provider_services;
  open_times text[];
  payments_on boolean := public.setting('payments_enabled') = 1;
begin
  select p.active into is_active from public.providers p where p.slug = new.provider_slug;
  if is_active is not true then raise exception 'That provider is not available for booking'; end if;

  select id into owner from public.profiles where provider_slug = new.provider_slug;
  if owner is not distinct from new.user_id then
    raise exception 'You cannot book your own listing';
  end if;

  select * into svc from public.provider_services s
    where s.provider_slug = new.provider_slug and s.name = new.service and s.active;
  if svc.id is null then raise exception 'That service is not offered'; end if;

  if new.scheduled_date < sa_now::date
     or (new.scheduled_date = sa_now::date and extract(hour from new.start_time) <= extract(hour from sa_now)) then
    raise exception 'Choose a time in the future';
  end if;

  select times into open_times from public.provider_hours
    where provider_slug = new.provider_slug and weekday = extract(dow from new.scheduled_date)::integer;
  if open_times is null or not (to_char(new.start_time, 'HH24:MI') = any (open_times))
     or exists (select 1 from public.provider_time_off
                where provider_slug = new.provider_slug and day = new.scheduled_date) then
    raise exception 'The provider is not available then';
  end if;

  if (select count(*) from public.bookings
        where user_id = new.user_id and status in ('pending', 'awaiting_payment'))
     >= public.setting('max_pending_per_customer') then
    raise exception 'You have too many open requests. Wait for some to be answered.';
  end if;

  -- Money and mode are never taken from the client.
  new.duration_minutes := svc.duration_minutes;
  new.price_cents := svc.from_price * 100;
  new.fee_cents := public.setting('customer_fee_cents')::integer;
  new.commission_pct := public.setting('commission_percent');
  new.commission_cents := round(new.price_cents * new.commission_pct / 100)::integer;
  new.earning_cents := new.price_cents - new.commission_cents;
  new.payment_status := 'unpaid';
  new.payout_status := 'none';

  if payments_on and svc.instant_booking then
    new.booking_mode := 'instant';
    new.status := 'awaiting_payment';
    new.expires_at := now() + make_interval(mins => public.setting('payment_window_minutes')::integer);
  else
    new.booking_mode := 'request';
    new.status := 'pending';
    new.expires_at := public.response_deadline(new.scheduled_date, new.start_time);
  end if;

  perform public.check_slot_free(new.provider_slug, new.scheduled_date, new.start_time,
                                 new.duration_minutes, new.id);
  return new;
end;
$$;

drop policy "Customers create their own pending bookings" on public.bookings;
create policy "Customers create their own pending bookings"
  on public.bookings for insert to authenticated
  with check ((select auth.uid()) = user_id and status in ('pending', 'awaiting_payment'));

-- The old index only compared start times. Overlaps are now checked, under a lock, by the
-- trigger above; this index stays as a last line of defence for confirmed work.
drop index public.bookings_slot_unique;
create unique index bookings_slot_unique
  on public.bookings (provider_slug, scheduled_date, start_time)
  where status in ('confirmed', 'in_progress', 'awaiting_confirmation');

-- 7. Moving, accepting and expiring: keep the slot safe and the deadlines right ----------------

create function public.enforce_booking_slot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  moved boolean := new.scheduled_date is distinct from old.scheduled_date
                or new.start_time is distinct from old.start_time;
  holding constant public.booking_status[] := array['pending', 'awaiting_payment', 'confirmed', 'in_progress']::public.booking_status[];
begin
  if new.status = any (holding) and (moved or not (old.status = any (holding))) then
    perform public.check_slot_free(new.provider_slug, new.scheduled_date, new.start_time,
                                   new.duration_minutes, new.id);
  end if;

  if new.status = 'pending' and moved then
    new.expires_at := public.response_deadline(new.scheduled_date, new.start_time);
  elsif old.status = 'pending' and new.status = 'awaiting_payment' then
    new.expires_at := now() + make_interval(mins => public.setting('payment_window_minutes')::integer);
  elsif new.status not in ('pending', 'awaiting_payment') then
    new.expires_at := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_booking_slot() from public, anon, authenticated;

create trigger bookings_enforce_slot
  before update on public.bookings
  for each row execute function public.enforce_booking_slot();

-- 8. Which status changes are allowed, and for whom -----------------------------------------

create or replace function public.enforce_booking_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  is_provider boolean;
  today date := (now() at time zone 'Africa/Johannesburg')::date;
  payments_on boolean := public.setting('payments_enabled') = 1;
begin
  if new.status = old.status then
    return new;
  end if;
  -- Server-side maintenance (no signed-in user), such as the expiry sweep, is unrestricted.
  if uid is null then
    return new;
  end if;
  if current_setting('pebble.rescheduling', true) = 'on' and new.status = 'pending' then
    return new;
  end if;

  -- An open request past its deadline can only be cancelled by the customer.
  if old.status in ('pending', 'awaiting_payment') and old.expires_at is not null
     and old.expires_at < now() and new.status <> 'cancelled' then
    raise exception 'This request has expired';
  end if;

  is_provider := old.provider_slug = public.current_provider_slug();

  if is_provider then
    if old.status = 'pending' then
      if new.status in ('cancelled', 'declined') then return new; end if;
      if new.status = 'confirmed' and not payments_on then return new; end if;
      if new.status = 'awaiting_payment' and payments_on then return new; end if;
    elsif old.status = 'awaiting_payment' and new.status = 'cancelled' then
      return new;
    elsif old.status = 'confirmed' then
      if new.status = 'cancelled' then return new; end if;
      if new.status in ('in_progress', 'completed', 'awaiting_confirmation') then
        if old.scheduled_date > today then
          raise exception 'A booking can only be started or completed on or after its date';
        end if;
        if new.status = 'in_progress' then return new; end if;
        if new.status = 'completed' and not payments_on then return new; end if;
        if new.status = 'awaiting_confirmation' and payments_on then return new; end if;
      end if;
    elsif old.status = 'in_progress' then
      if new.status = 'completed' and not payments_on then return new; end if;
      if new.status = 'awaiting_confirmation' and payments_on then return new; end if;
    end if;
  elsif uid = old.user_id then
    if old.status in ('pending', 'awaiting_payment', 'confirmed') and new.status = 'cancelled' then
      return new;
    end if;
    if old.status = 'awaiting_confirmation' and new.status in ('completed', 'disputed') then
      return new;
    end if;
  elsif (select public.is_admin()) then
    if old.status = 'disputed' and new.status in ('completed', 'cancelled') then
      return new;
    end if;
  end if;

  raise exception 'That status change is not allowed';
end;
$$;

-- 9. Activity log and notifications for the new statuses --------------------------------------

alter table public.booking_events drop constraint booking_events_kind_check;
alter table public.booking_events add constraint booking_events_kind_check check (kind in (
  'requested', 'confirmed', 'completed', 'cancelled', 'rescheduled',
  'awaiting_payment', 'in_progress', 'awaiting_confirmation', 'declined', 'expired', 'disputed'));

create or replace function public.log_booking_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  by_whom text := case when actor is not distinct from new.user_id then 'by the customer' else 'by the provider' end;
  owner uuid;
begin
  if new.scheduled_date <> old.scheduled_date or new.start_time <> old.start_time then
    insert into public.booking_events (booking_id, kind, detail)
    values (new.id, 'rescheduled',
      'Moved from ' || to_char(old.scheduled_date, 'Dy DD Mon') || ' ' || to_char(old.start_time, 'HH24:MI')
      || ' to ' || to_char(new.scheduled_date, 'Dy DD Mon') || ' ' || to_char(new.start_time, 'HH24:MI'));
    select id into owner from public.profiles where provider_slug = new.provider_slug;
    if owner is not null then
      perform public.notify(owner, 'booking_rescheduled', 'Booking rescheduled',
        new.service || ' moved to ' || to_char(new.scheduled_date, 'Dy DD Mon') || ' at '
        || to_char(new.start_time, 'HH24:MI') || '. Please confirm the new time.',
        '/dashboard/bookings/' || new.id);
    end if;
  end if;

  if new.status <> old.status and new.status <> 'pending' then
    insert into public.booking_events (booking_id, kind, detail)
    values (new.id, new.status::text,
      case when new.status = 'cancelled' then 'Cancelled ' || by_whom else '' end);
  end if;
  return new;
end;
$$;

create or replace function public.notify_on_booking_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
  who text;
  cat text;
  what text := new.service || ' on ' || to_char(new.scheduled_date, 'Dy DD Mon');
  customer_wants boolean;
  actor uuid := (select auth.uid());
  more text;
begin
  if new.status = old.status then return new; end if;
  select name, category into who, cat from public.providers where slug = new.provider_slug;
  select notify_bookings into customer_wants from public.profiles where id = new.user_id;
  select id into owner from public.profiles where provider_slug = new.provider_slug;
  more := '/explore?category=' || coalesce(cat, '');

  if new.status = 'cancelled' and actor is not distinct from new.user_id then
    if owner is not null then
      perform public.notify(owner, 'booking_cancelled', 'Booking cancelled by customer', what, '/dashboard/bookings');
    end if;
  elsif new.status = 'disputed' then
    if owner is not null then
      perform public.notify(owner, 'booking_disputed', 'The customer reported a problem', what, '/dashboard/bookings/' || new.id);
    end if;
    perform public.notify_admins('Booking disputed', what, '/admin/bookings');
  elsif new.status = 'expired' then
    perform public.notify(new.user_id, 'booking_expired',
      case when old.status = 'awaiting_payment' then 'Payment time ran out' else 'Request expired' end,
      coalesce(who, 'The provider') || ' did not confirm ' || what || '. Browse other providers.', more);
    if owner is not null and old.status = 'pending' then
      perform public.notify(owner, 'booking_expired', 'Request expired',
        'You did not answer the request for ' || what, '/dashboard/bookings');
    end if;
  elsif coalesce(customer_wants, true) then
    if new.status = 'confirmed' then
      perform public.notify(new.user_id, 'booking_confirmed', 'Booking confirmed',
        coalesce(who, 'Your provider') || ' confirmed ' || what, '/account/bookings');
    elsif new.status = 'awaiting_payment' then
      perform public.notify(new.user_id, 'booking_awaiting_payment', 'Accepted. Complete payment',
        coalesce(who, 'Your provider') || ' accepted ' || what || '. Pay to confirm your booking.',
        '/account/bookings/' || new.id);
    elsif new.status = 'declined' then
      perform public.notify(new.user_id, 'booking_declined', 'Request declined',
        coalesce(who, 'Your provider') || ' cannot do ' || what || '. Browse other providers.', more);
    elsif new.status = 'cancelled' then
      perform public.notify(new.user_id,
        'booking_cancelled',
        case when old.status = 'pending' then 'Booking declined' else 'Booking cancelled' end,
        coalesce(who, 'Your provider') || ' cannot do ' || what, '/account/bookings');
    elsif new.status = 'awaiting_confirmation' then
      perform public.notify(new.user_id, 'booking_awaiting_confirmation', 'Is the job done?',
        coalesce(who, 'Your provider') || ' marked ' || what || ' as finished. Please confirm.',
        '/account/bookings/' || new.id);
    elsif new.status = 'completed' then
      perform public.notify(new.user_id, 'booking_completed', 'Job complete',
        'How did ' || coalesce(who, 'your provider') || ' do? Leave a review.', '/account/reviews');
    end if;
  end if;
  return new;
end;
$$;

-- 10. Expiring open requests -----------------------------------------------------------------

create function public.expire_stale_bookings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  with gone as (
    update public.bookings
       set status = 'expired', expires_at = null
     where status in ('pending', 'awaiting_payment') and expires_at < now()
     returning 1
  )
  select count(*) into n from gone;
  return n;
end;
$$;

revoke execute on function public.expire_stale_bookings() from public, anon, authenticated;

-- Run it every minute when the database supports scheduled jobs.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('expire-stale-bookings', '* * * * *', 'select public.expire_stale_bookings()');
exception when others then
  raise notice 'Scheduled expiry not set up: %', sqlerrm;
end $$;

-- 11. Open times, honouring duration, buffers, capacity and holds ----------------------------

create function public.available_slots(p_slug text, p_from date, p_to date, p_service text default null)
returns table (day date, t text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  dur integer := 60;
  buf integer;
  cap integer;
  sa_now timestamp := now() at time zone 'Africa/Johannesburg';
begin
  if not exists (select 1 from public.providers p where p.slug = p_slug and p.active) then
    return;
  end if;
  if p_service is not null then
    select s.duration_minutes into dur from public.provider_services s
      where s.provider_slug = p_slug and s.name = p_service and s.active;
    dur := coalesce(dur, 60);
  end if;
  select ps.buffer_minutes, ps.max_daily_bookings into buf, cap
    from public.provider_booking_settings ps where ps.provider_slug = p_slug;
  buf := coalesce(buf, 0);

  return query
  select g.dd::date, u.slot
  from generate_series(p_from::timestamp, least(p_to, p_from + 60)::timestamp, interval '1 day') as g(dd)
  join public.provider_hours h
    on h.provider_slug = p_slug and h.weekday = extract(dow from g.dd)::integer
  cross join lateral unnest(h.times) as u(slot)
  where not exists (select 1 from public.provider_time_off o where o.provider_slug = p_slug and o.day = g.dd::date)
    and (g.dd::date > sa_now::date
         or (g.dd::date = sa_now::date and substr(u.slot, 1, 2)::integer > extract(hour from sa_now)))
    and (cap is null or (
         select count(*) from public.bookings b
         where b.provider_slug = p_slug and b.scheduled_date = g.dd::date
           and public.booking_holds_slot(b.status, b.expires_at)) < cap)
    and not exists (
         select 1 from public.bookings b
         where b.provider_slug = p_slug and b.scheduled_date = g.dd::date
           and public.booking_holds_slot(b.status, b.expires_at)
           and public.time_mins(u.slot::time) < public.time_mins(b.start_time) + b.duration_minutes + buf
           and public.time_mins(b.start_time) < public.time_mins(u.slot::time) + dur + buf)
  order by 1, 2;
end;
$$;

revoke execute on function public.available_slots(text, date, date, text) from public;
grant execute on function public.available_slots(text, date, date, text) to anon, authenticated;

-- The existing screens ask which start times are taken. Anything the provider offers that is
-- not actually open (booked, overlapping, buffered or at capacity) counts as taken.
create or replace function public.booked_times(p_slug text, p_from date, p_to date)
returns table (day date, t text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.dd::date, u.slot
  from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as g(dd)
  join public.provider_hours h
    on h.provider_slug = p_slug and h.weekday = extract(dow from g.dd)::integer
  cross join lateral unnest(h.times) as u(slot)
  where exists (select 1 from public.providers p where p.slug = p_slug and p.active)
  except
  select a.day, a.t from public.available_slots(p_slug, p_from, p_to) a
$$;

-- Other providers a customer could try when a request is declined or expires.
create function public.alternative_providers(p_booking uuid)
returns table (slug text, name text, rating numeric, next_day date, next_time text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare b public.bookings; cat text; town text;
begin
  select * into b from public.bookings x where x.id = p_booking;
  if b.id is null or not (b.user_id = (select auth.uid()) or (select public.is_admin())) then
    return;
  end if;
  select p.category, p.city into cat, town from public.providers p where p.slug = b.provider_slug;
  return query
  select p.slug, p.name, p.rating::numeric, o.day, o.t
  from public.providers p
  cross join lateral (
    select a.day, a.t from public.available_slots(p.slug, current_date, current_date + 14) a limit 1
  ) o
  where p.active and p.category = cat and p.city = town and p.slug <> b.provider_slug
  order by p.rating desc
  limit 5;
end;
$$;

revoke execute on function public.alternative_providers(uuid) from public, anon;
grant execute on function public.alternative_providers(uuid) to authenticated;

-- 12. Chat unlocks after confirmation once real payments are on -------------------------------

create function public.chat_is_open(p_booking uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.setting('payments_enabled') <> 1
      or exists (select 1 from public.bookings b where b.id = p_booking
                 and b.status in ('confirmed', 'in_progress', 'awaiting_confirmation', 'completed', 'disputed'))
$$;

revoke execute on function public.chat_is_open(uuid) from public, anon;
grant execute on function public.chat_is_open(uuid) to authenticated;

drop policy "Booking parties send messages" on public.messages;
create policy "Booking parties send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (b.user_id = (select auth.uid())
             or b.provider_slug = (select public.current_provider_slug()))
    )
    and public.chat_is_open(booking_id)
    and (image_path is null or image_path like booking_id::text || '/%')
  );

-- 13. Earnings are after commission ---------------------------------------------------------

create or replace function public.payout_balance()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select sum(b.earning_cents) from public.bookings b
    where b.provider_slug = public.current_provider_slug() and b.status = 'completed'
  ), 0)::integer - coalesce((
    select sum(p.amount_cents) from public.payouts p
    where p.provider_slug = public.current_provider_slug() and p.status in ('requested', 'paid')
  ), 0)::integer
$$;

-- 14. A provider whose listing is not live cannot act on any job ---------------------------------

create or replace function public.block_inactive_provider_jobs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('confirmed', 'awaiting_payment', 'in_progress', 'awaiting_confirmation', 'completed')
     and exists (select 1 from public.profiles
                 where id = (select auth.uid()) and provider_slug = old.provider_slug)
     and not exists (select 1 from public.providers where slug = old.provider_slug and active) then
    raise exception 'Your listing is not live right now';
  end if;
  return new;
end;
$$;
