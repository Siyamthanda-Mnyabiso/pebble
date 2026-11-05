select json_build_object(
 'bookings', (select count(*) from public.bookings),
 'by_status', (select json_object_agg(status, n) from (select status, count(*) n from public.bookings group by 1) s),
 'checksum', (select md5(string_agg(id::text||status::text||price_cents||commission_cents||earning_cents||fee_cents||scheduled_date||start_time, ',' order by id)) from public.bookings),
 'reviews', (select count(*) from public.reviews),
 'payouts', (select count(*) from public.payouts),
 'providers', (select count(*) from public.providers),
 'users', (select count(*) from public.profiles),
 'in_open_state', (select count(*) from public.bookings where status in ('confirmed','pending','awaiting_payment','in_progress'))
) as snapshot;
