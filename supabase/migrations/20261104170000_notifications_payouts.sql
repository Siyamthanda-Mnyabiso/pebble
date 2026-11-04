-- In-app notifications and a payout ledger.

-- Notifications -----------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  href text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "Users read their notifications"
  on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users mark their notifications read"
  on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Notifications are only ever created by the triggers below.
create function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_href text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body, href)
  values (p_user, p_kind, p_title, p_body, p_href)
$$;

revoke execute on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;

create function public.notify_on_booking_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare owner uuid;
begin
  select id into owner from public.profiles where provider_slug = new.provider_slug;
  if owner is not null then
    perform public.notify(owner, 'booking_request', 'New booking request',
      new.service || ' on ' || to_char(new.scheduled_date, 'Dy DD Mon') || ' at ' || to_char(new.start_time, 'HH24:MI'),
      '/dashboard/bookings');
  end if;
  return new;
end;
$$;

create function public.notify_on_booking_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
  who text;
  what text := new.service || ' on ' || to_char(new.scheduled_date, 'Dy DD Mon');
  customer_wants boolean;
  actor uuid := (select auth.uid());
begin
  if new.status = old.status then return new; end if;
  select name into who from public.providers where slug = new.provider_slug;
  select notify_bookings into customer_wants from public.profiles where id = new.user_id;
  select id into owner from public.profiles where provider_slug = new.provider_slug;

  if new.status = 'cancelled' and actor is not distinct from new.user_id then
    -- The customer cancelled: tell the provider.
    if owner is not null then
      perform public.notify(owner, 'booking_cancelled', 'Booking cancelled by customer', what, '/dashboard/bookings');
    end if;
  elsif coalesce(customer_wants, true) then
    if new.status = 'confirmed' then
      perform public.notify(new.user_id, 'booking_confirmed', 'Booking confirmed',
        coalesce(who, 'Your provider') || ' confirmed ' || what, '/account/bookings');
    elsif new.status = 'cancelled' then
      perform public.notify(new.user_id,
        'booking_cancelled',
        case when old.status = 'pending' then 'Booking declined' else 'Booking cancelled' end,
        coalesce(who, 'Your provider') || ' cannot do ' || what, '/account/bookings');
    elsif new.status = 'completed' then
      perform public.notify(new.user_id, 'booking_completed', 'Job complete',
        'How did ' || coalesce(who, 'your provider') || ' do? Leave a review.', '/account/reviews');
    end if;
  end if;
  return new;
end;
$$;

create function public.notify_on_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare owner uuid;
begin
  select id into owner from public.profiles where provider_slug = new.provider_slug;
  if owner is not null then
    perform public.notify(owner, 'review', 'New review',
      'A customer rated you ' || new.rating || ' out of 5.', '/dashboard/reviews');
  end if;
  return new;
end;
$$;

revoke execute on function public.notify_on_booking_insert() from public, anon, authenticated;
revoke execute on function public.notify_on_booking_status() from public, anon, authenticated;
revoke execute on function public.notify_on_review() from public, anon, authenticated;

create trigger bookings_notify_insert after insert on public.bookings
  for each row execute function public.notify_on_booking_insert();
create trigger bookings_notify_status after update on public.bookings
  for each row execute function public.notify_on_booking_status();
create trigger reviews_notify after insert on public.reviews
  for each row execute function public.notify_on_review();

-- Payouts -----------------------------------------------------------------------

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  provider_slug text not null references public.providers (slug) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'requested' check (status in ('requested', 'paid', 'rejected')),
  note text not null default '',
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- One open request per provider at a time.
create unique index payouts_one_open
  on public.payouts (provider_slug) where status = 'requested';

alter table public.payouts enable row level security;

create policy "Providers read their payouts"
  on public.payouts for select to authenticated
  using (provider_slug = (select public.current_provider_slug()));

grant select on public.payouts to authenticated;

-- Completed earnings not yet requested or paid out.
create function public.payout_balance()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select sum(b.price_cents) from public.bookings b
    where b.provider_slug = public.current_provider_slug() and b.status = 'completed'
  ), 0)::integer - coalesce((
    select sum(p.amount_cents) from public.payouts p
    where p.provider_slug = public.current_provider_slug() and p.status in ('requested', 'paid')
  ), 0)::integer
$$;

revoke execute on function public.payout_balance() from public, anon;
grant execute on function public.payout_balance() to authenticated;

-- Requests the whole available balance (minimum R100).
create function public.request_payout()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  slug text := public.current_provider_slug();
  amount integer := public.payout_balance();
begin
  if slug is null then raise exception 'No listing'; end if;
  if amount < 10000 then raise exception 'The minimum payout is R100'; end if;
  insert into public.payouts (provider_slug, amount_cents) values (slug, amount);
  return amount;
end;
$$;

revoke execute on function public.request_payout() from public, anon;
grant execute on function public.request_payout() to authenticated;

-- Tell the provider when a payout is settled.
create function public.notify_on_payout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare owner uuid;
begin
  if new.status = old.status then return new; end if;
  select id into owner from public.profiles where provider_slug = new.provider_slug;
  if owner is not null then
    perform public.notify(owner, 'payout',
      case new.status when 'paid' then 'Payout paid' else 'Payout not approved' end,
      'R' || (new.amount_cents / 100) || case when new.note <> '' then ' · ' || new.note else '' end,
      '/dashboard/earnings');
  end if;
  return new;
end;
$$;

revoke execute on function public.notify_on_payout() from public, anon, authenticated;

create trigger payouts_notify after update on public.payouts
  for each row execute function public.notify_on_payout();
