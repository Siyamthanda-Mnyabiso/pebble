-- Pebble's revenue is the commission taken from providers. The customer booking fee no longer exists, so the
-- admin totals now add up commission instead of fees. The JSON key stays the same so existing screens keep working.

create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  select jsonb_build_object(
    'bookings_total', (select count(*) from public.bookings),
    'bookings_30d', (select count(*) from public.bookings where created_at >= now() - interval '30 days'),
    'bookings_prev_30d', (select count(*) from public.bookings
        where created_at >= now() - interval '60 days' and created_at < now() - interval '30 days'),
    'providers_active', (select count(*) from public.provider_verification where status = 'approved'),
    'providers_pending', (select count(*) from public.provider_verification where status = 'pending_review'),
    'providers_suspended', (select count(*) from public.provider_verification where status = 'suspended'),
    'customers', (select count(*) from public.profiles where role = 'customer'),
    'fees_cents', (select coalesce(sum(commission_cents), 0) from public.bookings where status = 'completed'),
    'volume_cents', (select coalesce(sum(price_cents), 0) from public.bookings where status = 'completed'),
    'pending_payouts', (select count(*) from public.payouts where status = 'requested'),
    'pending_payout_cents', (select coalesce(sum(amount_cents), 0) from public.payouts where status = 'requested'),
    'paid_payout_cents', (select coalesce(sum(amount_cents), 0) from public.payouts where status = 'paid'),
    'avg_rating', (select coalesce(round(avg(rating)::numeric, 1), 0) from public.reviews where not hidden),
    'by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'n', coalesce(c.n, 0)) order by d), '[]')
        from generate_series((now() at time zone 'Africa/Johannesburg')::date - 29,
                             (now() at time zone 'Africa/Johannesburg')::date, interval '1 day') d
        left join (select (created_at at time zone 'Africa/Johannesburg')::date as dd, count(*) as n
                   from public.bookings group by 1) c on c.dd = d::date),
    'by_category', (select coalesce(jsonb_agg(jsonb_build_object('category', category, 'n', n) order by n desc), '[]')
        from (select p.category, count(*) n from public.bookings b
              join public.providers p on p.slug = b.provider_slug group by p.category) x),
    'months', (select coalesce(jsonb_agg(jsonb_build_object(
          'month', to_char(m, 'Mon YYYY'),
          'bookings', (select count(*) from public.bookings b where date_trunc('month', b.created_at) = m),
          'completed', (select count(*) from public.bookings b where b.status = 'completed' and date_trunc('month', b.created_at) = m),
          'cancelled', (select count(*) from public.bookings b where b.status = 'cancelled' and date_trunc('month', b.created_at) = m),
          'fees_cents', (select coalesce(sum(commission_cents), 0) from public.bookings b where b.status = 'completed' and date_trunc('month', b.created_at) = m)
        ) order by m desc), '[]')
        from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m)
  ) into result;
  return result;
end;
$$;

