-- Booking activity log and customer rescheduling.

-- Activity ------------------------------------------------------------------

create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  kind text not null check (kind in ('requested', 'confirmed', 'completed', 'cancelled', 'rescheduled')),
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index booking_events_booking_idx on public.booking_events (booking_id, created_at);

alter table public.booking_events enable row level security;

-- Visible to whoever can see the booking (the customer or the provider).
create policy "Booking parties read the activity"
  on public.booking_events for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id));

grant select on public.booking_events to authenticated;

-- Existing bookings get a first entry.
insert into public.booking_events (booking_id, kind, created_at)
select id, 'requested', created_at from public.bookings;

create function public.log_booking_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.booking_events (booking_id, kind) values (new.id, 'requested');
  return new;
end;
$$;

create function public.log_booking_update()
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

  if new.status <> old.status and new.status in ('confirmed', 'completed', 'cancelled') then
    insert into public.booking_events (booking_id, kind, detail)
    values (new.id, new.status::text, case when new.status = 'cancelled' then 'Cancelled ' || by_whom else '' end);
  end if;
  return new;
end;
$$;

revoke execute on function public.log_booking_insert() from public, anon, authenticated;
revoke execute on function public.log_booking_update() from public, anon, authenticated;

create trigger bookings_log_insert after insert on public.bookings
  for each row execute function public.log_booking_insert();
create trigger bookings_log_update after update on public.bookings
  for each row execute function public.log_booking_update();

-- Rescheduling status change: the rescheduling function may move a confirmed
-- booking back to pending. Nothing else may.
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
begin
  if new.status = old.status then
    return new;
  end if;
  if uid is null then
    return new;
  end if;
  if current_setting('pebble.rescheduling', true) = 'on' and new.status = 'pending' then
    return new;
  end if;

  is_provider := old.provider_slug = public.current_provider_slug();

  if is_provider then
    if old.status = 'pending' and new.status in ('confirmed', 'cancelled') then
      return new;
    elsif old.status = 'confirmed' and new.status = 'cancelled' then
      return new;
    elsif old.status = 'confirmed' and new.status = 'completed' then
      if old.scheduled_date > today then
        raise exception 'A booking can only be completed on or after its date';
      end if;
      return new;
    end if;
  elsif uid = old.user_id then
    if old.status in ('pending', 'confirmed') and new.status = 'cancelled' then
      return new;
    end if;
  end if;

  raise exception 'That status change is not allowed';
end;
$$;

-- Rescheduling -------------------------------------------------------------------

-- The customer picks a new date and time. The provider's weekly hours, time off
-- and existing bookings are checked here, not in the browser. The booking goes
-- back to pending so the provider confirms the new time.
create function public.reschedule_booking(p_id uuid, p_date date, p_time text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  b public.bookings;
  sa_now timestamp := now() at time zone 'Africa/Johannesburg';
  open_times text[];
begin
  select * into b from public.bookings where id = p_id and user_id = uid;
  if not found then raise exception 'We could not find that booking'; end if;
  if b.status not in ('pending', 'confirmed') then
    raise exception 'This booking can no longer be rescheduled';
  end if;
  if b.scheduled_date < sa_now::date then
    raise exception 'This booking can no longer be rescheduled';
  end if;
  if p_date < sa_now::date
     or (p_date = sa_now::date and substr(p_time, 1, 2)::int <= extract(hour from sa_now)) then
    raise exception 'Choose a time in the future';
  end if;
  if p_date = b.scheduled_date and p_time = to_char(b.start_time, 'HH24:MI') then
    raise exception 'That is already your booking time';
  end if;

  select times into open_times from public.provider_hours
    where provider_slug = b.provider_slug and weekday = extract(dow from p_date)::int;
  if open_times is null or not (p_time = any (open_times)) then
    raise exception 'The provider is not available then';
  end if;
  if exists (select 1 from public.provider_time_off where provider_slug = b.provider_slug and day = p_date) then
    raise exception 'The provider is not available then';
  end if;

  perform set_config('pebble.rescheduling', 'on', true);
  begin
    update public.bookings
      set scheduled_date = p_date, start_time = p_time::time, status = 'pending'
      where id = p_id;
  exception when unique_violation then
    raise exception 'That time was just taken. Choose another';
  end;
  perform set_config('pebble.rescheduling', 'off', true);
end;
$$;

revoke execute on function public.reschedule_booking(uuid, date, text) from public, anon;
grant execute on function public.reschedule_booking(uuid, date, text) to authenticated;
