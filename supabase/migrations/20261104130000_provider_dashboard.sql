-- Provider dashboard: link a provider account to a listing, let providers
-- manage the bookings made with them, and enforce which status changes are legal.

alter table public.profiles add column provider_slug text unique;
-- provider_slug is not in the column grant for updates, so a user can never
-- link themselves to a listing. It is set by the Pebble team.

create function public.current_provider_slug()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select provider_slug from public.profiles where id = (select auth.uid())
$$;

revoke execute on function public.current_provider_slug() from public, anon;
grant execute on function public.current_provider_slug() to authenticated;

-- Providers read the bookings made with their listing.
create policy "Providers read bookings for their listing"
  on public.bookings for select to authenticated
  using (provider_slug = (select public.current_provider_slug()));

-- Only the status column can ever be updated by a client.
revoke update on public.bookings from authenticated;
grant update (status) on public.bookings to authenticated;

create policy "Providers update bookings for their listing"
  on public.bookings for update to authenticated
  using (provider_slug = (select public.current_provider_slug()))
  with check (provider_slug = (select public.current_provider_slug()));

create policy "Customers cancel their own bookings"
  on public.bookings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Which transitions are allowed, and for whom.
create function public.enforce_booking_status()
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
  -- Server-side maintenance (no signed-in user) is unrestricted.
  if uid is null then
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

revoke execute on function public.enforce_booking_status() from public, anon, authenticated;

create trigger bookings_enforce_status
  before update on public.bookings
  for each row execute function public.enforce_booking_status();

-- Providers see the name and phone of customers who booked them.
create policy "Providers read customers who booked them"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.user_id = profiles.id
        and b.provider_slug = (select public.current_provider_slug())
    )
  );

-- Providers read reviews left on their listing.
create policy "Providers read reviews of their listing"
  on public.reviews for select to authenticated
  using (provider_slug = (select public.current_provider_slug()));
