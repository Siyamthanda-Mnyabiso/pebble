-- Pebble accounts: profiles, bookings, saved providers and reviews.
-- Providers are still static data in the app, so rows reference them by slug.

create type public.user_role as enum ('customer', 'provider');
create type public.booking_status as enum
  ('pending', 'confirmed', 'completed', 'cancelled');

-- Profiles ------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  address text not null default '',
  role public.user_role not null default 'customer',
  notify_bookings boolean not null default true,
  notify_reminders boolean not null default true,
  notify_offers boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

-- Role cannot be changed from the client: only the listed columns are updatable.
create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke update on public.profiles from authenticated;
grant update (full_name, phone, address, notify_bookings, notify_reminders, notify_offers)
  on public.profiles to authenticated;

-- A profile is created for every new auth user. Role comes from sign-up
-- metadata but can only ever be one of the two public roles.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    case when new.raw_user_meta_data ->> 'role' = 'provider'
      then 'provider'::public.user_role
      else 'customer'::public.user_role
    end
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Bookings ------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_slug text not null,
  service text not null,
  scheduled_date date not null,
  start_time time not null,
  address text not null check (char_length(address) between 5 and 200),
  notes text not null default '' check (char_length(notes) <= 500),
  price_cents integer not null check (price_cents >= 0),
  fee_cents integer not null default 2500 check (fee_cents >= 0),
  status public.booking_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index bookings_user_idx on public.bookings (user_id, scheduled_date);

alter table public.bookings enable row level security;

create policy "Customers read their own bookings"
  on public.bookings for select to authenticated
  using ((select auth.uid()) = user_id);

-- New bookings are always pending and belong to the caller. Status changes
-- (confirm, complete) will come from the provider side later.
create policy "Customers create their own pending bookings"
  on public.bookings for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'pending');

-- Saved providers -----------------------------------------------------------

create table public.saved_providers (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_slug text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, provider_slug)
);

alter table public.saved_providers enable row level security;

create policy "Users manage their saved providers"
  on public.saved_providers for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Reviews -------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  provider_slug text not null,
  rating smallint not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 1000),
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

create policy "Users read their own reviews"
  on public.reviews for select to authenticated
  using ((select auth.uid()) = user_id);

-- Only for the caller's own completed bookings.
create policy "Users review their own completed bookings"
  on public.reviews for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and b.user_id = (select auth.uid())
        and b.status = 'completed'
    )
  );
