-- Platform admin: a flag on the profile, read access to everything, and a few
-- write actions that only run for admins.

alter table public.profiles add column is_admin boolean not null default false;
-- profiles already only allow updating a short list of columns, so is_admin
-- can only be set from the database.

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = (select auth.uid())), false)
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create policy "Admins read all profiles" on public.profiles for select to authenticated
  using ((select public.is_admin()));
create policy "Admins read all bookings" on public.bookings for select to authenticated
  using ((select public.is_admin()));
create policy "Admins read all reviews" on public.reviews for select to authenticated
  using ((select public.is_admin()));
create policy "Admins read all payouts" on public.payouts for select to authenticated
  using ((select public.is_admin()));

-- Hidden reviews stay in the database but are not shown on provider pages.
alter table public.reviews add column hidden boolean not null default false;

create or replace function public.provider_reviews(p_slug text)
returns table (rating smallint, body text, first_name text, service text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.rating, r.body,
    coalesce(nullif(split_part(p.full_name, ' ', 1), ''), 'A customer'),
    b.service, r.created_at
  from public.reviews r
  join public.bookings b on b.id = r.booking_id
  left join public.profiles p on p.id = r.user_id
  where r.provider_slug = p_slug and not r.hidden
  order by r.created_at desc
  limit 20
$$;

create function public.admin_set_provider(p_slug text, p_verified boolean, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  update public.providers set verified = p_verified, active = p_active where slug = p_slug;
  if not found then raise exception 'Provider not found'; end if;
end;
$$;

create function public.admin_resolve_payout(p_id uuid, p_status text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  if p_status not in ('paid', 'rejected') then raise exception 'Invalid status'; end if;
  update public.payouts
     set status = p_status, note = left(coalesce(p_note, ''), 200), resolved_at = now()
   where id = p_id and status = 'requested';
  if not found then raise exception 'That payout is not open'; end if;
end;
$$;

create function public.admin_set_review_hidden(p_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  update public.reviews set hidden = p_hidden where id = p_id;
  if not found then raise exception 'Review not found'; end if;
end;
$$;

create function public.admin_stats()
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
    'providers_active', (select count(*) from public.providers where active and verified),
    'providers_pending', (select count(*) from public.providers where active and not verified),
    'providers_suspended', (select count(*) from public.providers where not active),
    'customers', (select count(*) from public.profiles where role = 'customer'),
    'fees_cents', (select coalesce(sum(fee_cents), 0) from public.bookings where status = 'completed'),
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
          'fees_cents', (select coalesce(sum(fee_cents), 0) from public.bookings b where b.status = 'completed' and date_trunc('month', b.created_at) = m)
        ) order by m desc), '[]')
        from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m)
  ) into result;
  return result;
end;
$$;

revoke execute on function public.admin_set_provider(text, boolean, boolean) from public, anon;
revoke execute on function public.admin_resolve_payout(uuid, text, text) from public, anon;
revoke execute on function public.admin_set_review_hidden(uuid, boolean) from public, anon;
revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_set_provider(text, boolean, boolean) to authenticated;
grant execute on function public.admin_resolve_payout(uuid, text, text) to authenticated;
grant execute on function public.admin_set_review_hidden(uuid, boolean) to authenticated;
grant execute on function public.admin_stats() to authenticated;
