-- Providers move from static data into the database: listings, services,
-- weekly hours and time off. Providers edit their own rows; everyone can read.

create table public.providers (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  name text not null check (char_length(name) between 2 and 80),
  category text not null check (category in
    ('cleaning','plumbing','electrical','gardening','painting','moving','beauty','photography')),
  tagline text not null default '' check (char_length(tagline) <= 120),
  about text not null default '' check (char_length(about) <= 1000),
  area text not null default 'Cape Town' check (char_length(area) between 2 and 60),
  distance_km integer not null default 10 check (distance_km between 0 and 500),
  verified boolean not null default false,
  featured boolean not null default false,
  image text not null,
  gallery text[] not null default '{}',
  work text[] not null default '{}',
  reply_time text not null default 'Usually replies within a day.' check (char_length(reply_time) <= 80),
  rating numeric(2,1) not null default 0 check (rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  rating_total numeric not null default 0,
  sample_reviews jsonb not null default '[]',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.providers enable row level security;

create policy "Anyone can read active providers"
  on public.providers for select to anon, authenticated
  using (active);

create policy "Providers update their own listing"
  on public.providers for update to authenticated
  using (slug = (select public.current_provider_slug()))
  with check (slug = (select public.current_provider_slug()));

grant select on public.providers to anon, authenticated;
-- verified, featured, ratings and photos are not editable by providers.
grant update (name, category, tagline, about, area, reply_time)
  on public.providers to authenticated;

alter table public.profiles
  add constraint profiles_provider_slug_fkey
  foreign key (provider_slug) references public.providers (slug);

-- Services ------------------------------------------------------------------

create table public.provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_slug text not null references public.providers (slug) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  detail text not null default '' check (char_length(detail) <= 120),
  from_price integer not null check (from_price between 0 and 100000),
  position integer not null default 0,
  unique (provider_slug, name)
);

alter table public.provider_services enable row level security;

create policy "Anyone can read services"
  on public.provider_services for select to anon, authenticated using (true);
create policy "Providers add their services"
  on public.provider_services for insert to authenticated
  with check (provider_slug = (select public.current_provider_slug()));
create policy "Providers edit their services"
  on public.provider_services for update to authenticated
  using (provider_slug = (select public.current_provider_slug()))
  with check (provider_slug = (select public.current_provider_slug()));
create policy "Providers delete their services"
  on public.provider_services for delete to authenticated
  using (provider_slug = (select public.current_provider_slug()));

grant select on public.provider_services to anon, authenticated;
grant insert (provider_slug, name, detail, from_price, position),
  update (name, detail, from_price, position), delete
  on public.provider_services to authenticated;

-- Weekly hours: weekday 0 = Sunday ... 6 = Saturday; empty times = day off.
create table public.provider_hours (
  provider_slug text not null references public.providers (slug) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  times text[] not null default '{}'
    check (times <@ array['08:00','10:00','12:00','14:00','16:00']::text[]),
  primary key (provider_slug, weekday)
);

alter table public.provider_hours enable row level security;

create policy "Anyone can read hours"
  on public.provider_hours for select to anon, authenticated using (true);
create policy "Providers add their hours"
  on public.provider_hours for insert to authenticated
  with check (provider_slug = (select public.current_provider_slug()));
create policy "Providers edit their hours"
  on public.provider_hours for update to authenticated
  using (provider_slug = (select public.current_provider_slug()))
  with check (provider_slug = (select public.current_provider_slug()));

grant select on public.provider_hours to anon, authenticated;
grant insert (provider_slug, weekday, times), update (times)
  on public.provider_hours to authenticated;

create table public.provider_time_off (
  provider_slug text not null references public.providers (slug) on delete cascade,
  day date not null,
  primary key (provider_slug, day)
);

alter table public.provider_time_off enable row level security;

create policy "Anyone can read time off"
  on public.provider_time_off for select to anon, authenticated using (true);
create policy "Providers add time off"
  on public.provider_time_off for insert to authenticated
  with check (provider_slug = (select public.current_provider_slug()));
create policy "Providers remove time off"
  on public.provider_time_off for delete to authenticated
  using (provider_slug = (select public.current_provider_slug()));

grant select on public.provider_time_off to anon, authenticated;
grant insert, delete on public.provider_time_off to authenticated;

-- Double bookings --------------------------------------------------------------

create unique index bookings_slot_unique
  on public.bookings (provider_slug, scheduled_date, start_time)
  where status in ('pending', 'confirmed');

-- Taken slots, without exposing who booked them.
create function public.booked_times(p_slug text, p_from date, p_to date)
returns table (day date, t text)
language sql
stable
security definer
set search_path = ''
as $$
  select scheduled_date, to_char(start_time, 'HH24:MI')
  from public.bookings
  where provider_slug = p_slug
    and scheduled_date between p_from and p_to
    and status in ('pending', 'confirmed')
$$;

revoke execute on function public.booked_times(text, date, date) from public;
grant execute on function public.booked_times(text, date, date) to anon, authenticated;

-- Reviews ----------------------------------------------------------------------

-- Public view of real reviews: first name only.
create function public.provider_reviews(p_slug text)
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
  where r.provider_slug = p_slug
  order by r.created_at desc
  limit 20
$$;

revoke execute on function public.provider_reviews(text) from public;
grant execute on function public.provider_reviews(text) to anon, authenticated;

-- A new review updates the provider's rating.
create function public.apply_review_to_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.providers
  set rating_total = rating_total + new.rating,
      review_count = review_count + 1,
      rating = round((rating_total + new.rating) / (review_count + 1), 1)
  where slug = new.provider_slug;
  return new;
end;
$$;

revoke execute on function public.apply_review_to_rating() from public, anon, authenticated;

create trigger reviews_update_rating
  after insert on public.reviews
  for each row execute function public.apply_review_to_rating();

-- Creating a listing ------------------------------------------------------------

-- A provider account can create its own listing once. The slug is generated
-- here and the profile link is set here, because clients cannot write it.
create function public.create_my_listing(p_name text, p_category text, p_area text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  base text;
  candidate text;
  img text;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if not exists (
    select 1 from public.profiles where id = uid and role = 'provider' and provider_slug is null
  ) then
    raise exception 'This account cannot create a listing';
  end if;

  base := trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'));
  if char_length(base) < 3 then base := 'provider'; end if;
  base := left(base, 50);
  candidate := base;
  while exists (select 1 from public.providers where slug = candidate) loop
    candidate := base || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  img := case p_category
    when 'plumbing' then '/images/work-pipework.jpg'
    when 'painting' then '/images/hero-painter.jpg'
    else '/images/' || p_category || '.jpg'
  end;

  insert into public.providers (slug, name, category, area, image, gallery, work)
  values (candidate, trim(p_name), p_category, trim(p_area), img, array[img], array[img]);

  insert into public.provider_hours (provider_slug, weekday, times)
  select candidate, d,
    case when d between 1 and 5 then array['08:00','10:00','12:00','14:00','16:00']
         when d = 6 then array['08:00','10:00'] else '{}'::text[] end
  from generate_series(0, 6) d;

  update public.profiles set provider_slug = candidate where id = uid;
  return candidate;
end;
$$;

revoke execute on function public.create_my_listing(text, text, text) from public, anon;
grant execute on function public.create_my_listing(text, text, text) to authenticated;
