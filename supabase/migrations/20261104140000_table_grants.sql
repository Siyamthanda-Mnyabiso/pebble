-- This project does not grant table access to the API roles automatically,
-- so grant exactly what the app needs. Row level security still decides
-- which rows each user can touch.

revoke all on public.profiles, public.bookings, public.saved_providers,
  public.reviews, public.contact_messages from anon, authenticated;

grant select on public.profiles to authenticated;
-- (update on profiles stays limited to the columns granted in the first migration)
grant update (full_name, phone, address, notify_bookings, notify_reminders, notify_offers)
  on public.profiles to authenticated;

grant select, insert on public.bookings to authenticated;
grant update (status) on public.bookings to authenticated;

grant select, insert, delete on public.saved_providers to authenticated;

grant select, insert on public.reviews to authenticated;

grant insert on public.contact_messages to anon, authenticated;
