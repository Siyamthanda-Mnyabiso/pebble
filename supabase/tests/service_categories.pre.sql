-- Fingerprint of providers, services and bookings before the service_categories migration runs.
-- The test compares it with the same fingerprint afterwards: nothing existing may change.
create temp table pre_snapshot as select
 (select md5(coalesce(string_agg(p.slug||p.category||p.name||p.active::text||p.verified::text, ',' order by p.slug), '')) from public.providers p) providers_md5,
 (select md5(coalesce(string_agg(id::text||provider_slug||name||from_price||duration_minutes||instant_booking::text||active::text, ',' order by id), '')) from public.provider_services) services_md5,
 (select md5(coalesce(string_agg(id::text||status::text||service||price_cents||commission_cents||earning_cents, ',' order by id), '')) from public.bookings) bookings_md5,
 (select count(*) from public.providers) n_providers,
 (select count(*) from public.provider_services) n_services,
 (select count(*) from public.bookings) n_bookings;
