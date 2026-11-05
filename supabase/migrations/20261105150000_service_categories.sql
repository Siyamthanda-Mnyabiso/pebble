-- Service categories managed in the database.
--
-- Categories and the services inside them are rows, not code: an admin creates or edits them and
-- providers pick from what is active. Deactivating anything is a soft switch, so providers,
-- provider_services and bookings that already exist keep working and nothing is ever deleted.
-- Payments stay off: this migration touches no money setting.

-- 1. Catalogue ---------------------------------------------------------------------------------

-- Requirements are a list of {key, label, kind, required}; kind is a provider document kind.
create function public.valid_category_requirements(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p) > 20 then false
  else coalesce((
    select bool_and(
      jsonb_typeof(e) = 'object'
      and coalesce(e->>'key', '') ~ '^[a-z0-9_]{2,40}$'
      and char_length(coalesce(e->>'label', '')) between 2 and 120
      and coalesce((e->>'kind') in ('id', 'business', 'certification', 'reference', 'screening', 'safeguarding', 'qualification'), false)
      and (not (e ? 'required') or jsonb_typeof(e->'required') = 'boolean'))
    from jsonb_array_elements(p) e), true) end
$$;

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  description text not null default '' check (char_length(description) <= 300),
  icon text not null default 'sparkles' check (char_length(icon) between 2 and 20),
  image text not null default '/images/room-living.jpg' check (char_length(image) between 2 and 200),
  sort_order integer not null default 100,
  -- Soft switch. Inactive categories are hidden from browsing and cannot be chosen by anyone new.
  active boolean not null default false,
  -- Categories from before this system. They keep working but are closed to new providers.
  is_legacy boolean not null default false,
  open_to_new_providers boolean not null default true,
  -- A legacy category can point at its replacement so old links and searches still land somewhere.
  alias_of uuid references public.service_categories (id) on delete restrict,
  -- Rules the database enforces for every provider in the category.
  allow_instant_booking boolean not null default true,
  requires_licence boolean not null default false,
  enhanced_verification boolean not null default false,
  requires_business_registration boolean not null default false,
  min_notice_hours integer not null default 0 check (min_notice_hours between 0 and 720),
  max_duration_minutes integer check (max_duration_minutes between 15 and 720),
  -- Extra documents a provider must upload before approval.
  requirements jsonb not null default '[]' check (public.valid_category_requirements(requirements)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index service_categories_name_idx on public.service_categories (lower(btrim(name)));

create table public.category_services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  description text not null default '' check (char_length(description) <= 200),
  suggested_duration_minutes integer not null default 60 check (suggested_duration_minutes between 15 and 720),
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index category_services_name_idx on public.category_services (category_id, lower(btrim(name)));

create table public.provider_categories (
  provider_slug text not null references public.providers (slug) on delete cascade,
  category_id uuid not null references public.service_categories (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (provider_slug, category_id)
);
create index provider_categories_category_idx on public.provider_categories (category_id);

create table public.category_events (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.service_categories (id) on delete restrict,
  service_id uuid references public.category_services (id) on delete restrict,
  kind text not null,
  detail jsonb not null default '{}',
  actor uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index category_events_idx on public.category_events (category_id, created_at);

alter table public.providers
  add column experience text not null default '' check (char_length(experience) <= 1000),
  add column skills text[] not null default '{}' check (cardinality(skills) <= 12);
grant update (experience, skills) on public.providers to authenticated;

alter table public.provider_services
  add column service_id uuid references public.category_services (id) on delete restrict;
create index provider_services_service_idx on public.provider_services (service_id) where service_id is not null;
grant insert (service_id) on public.provider_services to authenticated;

-- More document kinds for category requirements.
alter table public.provider_documents drop constraint provider_documents_kind_check;
alter table public.provider_documents add constraint provider_documents_kind_check
  check (kind in ('id', 'business', 'certification', 'reference', 'screening', 'safeguarding', 'qualification'));

-- 2. Seed: legacy categories first so existing providers stay valid -----------------------------

insert into public.service_categories (slug, name, icon, image, sort_order, active, is_legacy, open_to_new_providers, requires_licence) values
  ('cleaning', 'Cleaning', 'spray', '/images/cleaning.jpg', 900, true, true, false, false),
  ('plumbing', 'Plumbing', 'tap', '/images/work-pipework.jpg', 910, true, true, false, true),
  ('electrical', 'Electrical', 'bolt', '/images/electrical.jpg', 920, true, true, false, true),
  ('gardening', 'Gardening', 'leaf', '/images/gardening.jpg', 930, true, true, false, false),
  ('painting', 'Painting', 'roller', '/images/hero-painter.jpg', 940, true, true, false, false),
  ('moving', 'Moving', 'box', '/images/moving.jpg', 950, true, true, false, false),
  -- Pebble does not offer beauty or photography. The rows stay only so older records remain valid;
  -- they are switched off and closed to everyone.
  ('beauty', 'Beauty', 'scissors', '/images/beauty.jpg', 960, false, true, false, false),
  ('photography', 'Photography', 'camera', '/images/photography.jpg', 970, false, true, false, false);

-- The six launch categories, active.
insert into public.service_categories
  (slug, name, description, icon, image, sort_order, active, allow_instant_booking) values
  ('gardening-outdoor-care', 'Gardening & Outdoor Care', 'Lawns, hedges and tidy yards.', 'leaf', '/images/gardening.jpg', 10, true, true),
  ('home-cleaning', 'Home Cleaning', 'Regular and deep cleaning, laundry and ironing.', 'spray', '/images/cleaning.jpg', 20, true, true),
  ('car-washing-detailing', 'Car Washing & Detailing', 'Washes, valets and interior cleaning.', 'sparkles', '/images/pro-van.jpg', 30, true, true),
  -- Pet care involves animals and home access, so providers approve each request themselves.
  ('pet-care', 'Pet Care', 'Walking, sitting, feeding and basic grooming.', 'heart', '/images/room-living.jpg', 40, true, false),
  ('tutoring-education', 'Tutoring & Education', 'Lessons, homework help and exam preparation.', 'user', '/images/room-living.jpg', 50, true, true),
  ('handyman-home-assistance', 'Handyman & Home Assistance', 'Assembly, hanging, painting and helping hands.', 'roller', '/images/hero-painter.jpg', 60, true, true);

-- Future categories: the structure is ready, nothing is switched on.
insert into public.service_categories
  (slug, name, description, icon, sort_order, active, allow_instant_booking, requires_licence,
   enhanced_verification, requires_business_registration, min_notice_hours, requirements) values
  ('babysitting-childcare', 'Babysitting & Childcare', 'Care for children at home.', 'heart', 110, false, false, false, true, false, 24,
   '[{"key":"id_copy","label":"Certified copy of your ID","kind":"id","required":true},
     {"key":"references","label":"Written references from two families","kind":"reference","required":true},
     {"key":"background_screening","label":"Background screening result","kind":"screening","required":true},
     {"key":"safeguarding","label":"Child safeguarding declaration and first aid certificate","kind":"safeguarding","required":true}]'),
  ('event-assistance', 'Event Assistance', 'Setup, serving and helping hands for events.', 'calendar', 130, false, false, false, false, false, 48, '[]'),
  ('technology-assistance', 'Technology Assistance', 'Devices, Wi-Fi and software help.', 'bolt', 140, false, true, false, false, false, 0, '[]'),
  ('professional-trades', 'Professional Trades', 'Regulated trades that need a licence.', 'tap', 150, false, false, true, false, true, 0,
   '[{"key":"licence","label":"Trade licence or professional registration","kind":"certification","required":true},
     {"key":"qualification","label":"Qualification certificate","kind":"qualification","required":true}]');

with s(cat, name, mins, ord) as (values
  ('gardening-outdoor-care', 'Grass cutting', 90, 10), ('gardening-outdoor-care', 'Garden maintenance', 180, 20),
  ('gardening-outdoor-care', 'Hedge trimming', 120, 30), ('gardening-outdoor-care', 'Weeding', 120, 40),
  ('gardening-outdoor-care', 'Leaf removal', 120, 50), ('gardening-outdoor-care', 'Yard cleaning', 150, 60),
  ('home-cleaning', 'General house cleaning', 180, 10), ('home-cleaning', 'Deep cleaning', 300, 20),
  ('home-cleaning', 'Window cleaning', 120, 30), ('home-cleaning', 'Laundry', 120, 40),
  ('home-cleaning', 'Ironing', 90, 50), ('home-cleaning', 'Move-in/move-out cleaning', 300, 60),
  ('car-washing-detailing', 'Exterior car washing', 45, 10), ('car-washing-detailing', 'Interior cleaning', 60, 20),
  ('car-washing-detailing', 'Full car wash', 90, 30), ('car-washing-detailing', 'Vacuuming', 30, 40),
  ('car-washing-detailing', 'Basic car detailing', 180, 50),
  ('pet-care', 'Dog walking', 45, 10), ('pet-care', 'Pet sitting', 120, 20),
  ('pet-care', 'Pet feeding', 30, 30), ('pet-care', 'Basic pet grooming', 60, 40),
  ('tutoring-education', 'Mathematics tutoring', 60, 10), ('tutoring-education', 'English tutoring', 60, 20),
  ('tutoring-education', 'Homework assistance', 60, 30), ('tutoring-education', 'Computer lessons', 60, 40),
  ('tutoring-education', 'Exam preparation', 90, 50),
  ('handyman-home-assistance', 'Furniture assembly', 120, 10), ('handyman-home-assistance', 'Hanging pictures', 60, 20),
  ('handyman-home-assistance', 'Basic painting', 240, 30), ('handyman-home-assistance', 'Moving assistance', 180, 40),
  ('handyman-home-assistance', 'Minor non-regulated household repairs', 120, 50))
insert into public.category_services (category_id, name, suggested_duration_minutes, sort_order)
select c.id, s.name, s.mins, s.ord from s join public.service_categories c on c.slug = s.cat;

-- Old categories that have a clear new home point to it.
update public.service_categories l set alias_of = n.id
from public.service_categories n
where (l.slug, n.slug) in (('cleaning', 'home-cleaning'), ('gardening', 'gardening-outdoor-care'),
                           ('painting', 'handyman-home-assistance'), ('moving', 'handyman-home-assistance'));

-- 3. Providers point at the catalogue, existing rows migrated without changing them -------------

alter table public.providers drop constraint providers_category_check;
alter table public.providers add constraint providers_category_fkey
  foreign key (category) references public.service_categories (slug) on update restrict on delete restrict;

-- Every provider belongs to their own category, and to its replacement when there is one.
insert into public.provider_categories (provider_slug, category_id)
select p.slug, c.id from public.providers p join public.service_categories c on c.slug = p.category
on conflict do nothing;
insert into public.provider_categories (provider_slug, category_id)
select p.slug, c.alias_of from public.providers p join public.service_categories c on c.slug = p.category
where c.alias_of is not null
on conflict do nothing;

-- Free-text services that match a catalogue service in the replacement category by name get linked.
-- Nothing else is touched: names, prices and durations stay exactly as they were.
update public.provider_services ps set service_id = cs.id
from public.providers p
join public.service_categories c on c.slug = p.category
join public.category_services cs on cs.category_id = c.alias_of
where ps.provider_slug = p.slug and ps.service_id is null
  and lower(btrim(ps.name)) = lower(btrim(cs.name));

-- 4. Row security: everyone reads what is public, nobody writes directly ---------------------------

alter table public.service_categories enable row level security;
alter table public.category_services enable row level security;
alter table public.provider_categories enable row level security;
alter table public.category_events enable row level security;

revoke all on public.service_categories, public.category_services, public.provider_categories, public.category_events
  from anon, authenticated;

-- Visitors (anon) cannot call is_admin() or current_provider_slug(), so they get their own policies.
create policy "Visitors read categories that are live or in use"
  on public.service_categories for select to anon
  using (
    active
    or exists (select 1 from public.providers p where p.category = service_categories.slug and p.active)
  );
create policy "Signed in reads categories that are live or in use"
  on public.service_categories for select to authenticated
  using (
    active
    or (select public.is_admin())
    or exists (select 1 from public.providers p where p.category = service_categories.slug and p.active)
    or exists (select 1 from public.provider_categories pc
               where pc.category_id = service_categories.id
                 and pc.provider_slug = (select public.current_provider_slug()))
  );
create policy "Visitors read services that are live or in use"
  on public.category_services for select to anon
  using (
    active
    or exists (select 1 from public.provider_services ps join public.providers p on p.slug = ps.provider_slug
               where ps.service_id = category_services.id and p.active)
  );
create policy "Signed in reads services that are live or in use"
  on public.category_services for select to authenticated
  using (
    active
    or (select public.is_admin())
    or exists (select 1 from public.provider_services ps join public.providers p on p.slug = ps.provider_slug
               where ps.service_id = category_services.id
                 and (p.active or p.slug = (select public.current_provider_slug())))
  );
create policy "Visitors read live provider categories"
  on public.provider_categories for select to anon
  using (exists (select 1 from public.providers p where p.slug = provider_categories.provider_slug and p.active));
create policy "Signed in reads provider categories"
  on public.provider_categories for select to authenticated
  using (
    provider_categories.provider_slug = (select public.current_provider_slug())
    or (select public.is_admin())
    or exists (select 1 from public.providers p where p.slug = provider_categories.provider_slug and p.active)
  );
create policy "Providers choose their categories"
  on public.provider_categories for insert to authenticated
  with check (provider_slug = (select public.current_provider_slug()));
create policy "Providers drop their categories"
  on public.provider_categories for delete to authenticated
  using (provider_slug = (select public.current_provider_slug()));
create policy "Admins read category events"
  on public.category_events for select to authenticated
  using ((select public.is_admin()));

grant select on public.service_categories, public.category_services, public.provider_categories to anon, authenticated;
grant insert (provider_slug, category_id), delete on public.provider_categories to authenticated;
grant select on public.category_events to authenticated;

-- 5. Guards on the catalogue itself --------------------------------------------------------------

create function public.guard_category_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is distinct from old.slug then raise exception 'A category address cannot change'; end if;
  if new.alias_of = new.id then raise exception 'A category cannot point at itself'; end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger service_categories_guard before update on public.service_categories
  for each row execute function public.guard_category_slug();

-- When a category stops allowing instant booking, its services fall back to manual approval.
create function public.cascade_category_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.allow_instant_booking and not new.allow_instant_booking then
    update public.provider_services ps set instant_booking = false
    where ps.instant_booking
      and (ps.service_id in (select id from public.category_services where category_id = new.id)
           or (ps.service_id is null and ps.provider_slug in (select slug from public.providers where category = new.slug)));
  end if;
  return new;
end;
$$;
revoke execute on function public.cascade_category_rules() from public, anon, authenticated;
create trigger service_categories_cascade after update on public.service_categories
  for each row execute function public.cascade_category_rules();

create function public.touch_category_service()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger category_services_touch before update on public.category_services
  for each row execute function public.touch_category_service();

-- Renaming a catalogue service renames it for the providers who offer it. Past bookings keep the
-- name they were made with.
create function public.propagate_service_rename()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name is distinct from old.name then
    update public.provider_services ps set name = new.name
    where ps.service_id = new.id
      and not exists (select 1 from public.provider_services o
                      where o.provider_slug = ps.provider_slug and o.name = new.name and o.id <> ps.id);
  end if;
  return new;
end;
$$;
revoke execute on function public.propagate_service_rename() from public, anon, authenticated;
create trigger category_services_rename after update on public.category_services
  for each row execute function public.propagate_service_rename();

-- 6. Provider services: only active catalogue services, category rules enforced here -------------

create function public.enforce_provider_service()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cs public.category_services;
  cat public.service_categories;
  prim public.service_categories;
  changed boolean;
  instant_on boolean;
  longer boolean;
begin
  if tg_op = 'INSERT' then
    changed := true; instant_on := new.instant_booking; longer := true;
  else
    changed := new.service_id is distinct from old.service_id;
    instant_on := new.instant_booking and (changed or not old.instant_booking);
    longer := changed or new.duration_minutes is distinct from old.duration_minutes;
  end if;

  select c.* into prim from public.providers p join public.service_categories c on c.slug = p.category
    where p.slug = new.provider_slug;

  if new.service_id is not null then
    select * into cs from public.category_services where id = new.service_id;
    select * into cat from public.service_categories where id = cs.category_id;
    if changed then
      if cs.id is null or not cs.active or not cat.active then
        raise exception 'That service is not available';
      end if;
      if not exists (select 1 from public.provider_categories
                     where provider_slug = new.provider_slug and category_id = cat.id) then
        raise exception 'Add the % category before choosing its services', cat.name;
      end if;
    end if;
    -- The name always comes from the catalogue, so it matches what customers search for.
    new.name := cs.name;
  else
    -- Free-text services only exist for providers who joined before the catalogue.
    if tg_op = 'INSERT' and not coalesce(prim.is_legacy, false) then
      raise exception 'Choose your service from the list for your category';
    end if;
    cat := prim;
  end if;

  if cat.id is not null then
    if instant_on and not cat.allow_instant_booking then
      raise exception 'Instant booking is not available for % services. You approve each request yourself.', cat.name;
    end if;
    if longer and cat.max_duration_minutes is not null and new.duration_minutes > cat.max_duration_minutes then
      raise exception 'Services in % can be at most % minutes', cat.name, cat.max_duration_minutes;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_provider_service() from public, anon, authenticated;
create trigger provider_services_catalogue before insert or update on public.provider_services
  for each row execute function public.enforce_provider_service();

-- 7. Provider categories: who may add or drop one, and when -----------------------------------------

create function public.enforce_provider_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pslug text := coalesce(new.provider_slug, old.provider_slug);
  st text;
  cat public.service_categories;
  uid uuid := (select auth.uid());
begin
  -- Internal syncing, admins and the database owner are not limited.
  if current_setting('pebble.sync_category', true) = '1' then return coalesce(new, old); end if;
  if not exists (select 1 from public.profiles where id = uid and provider_slug = pslug) then
    return coalesce(new, old);
  end if;
  select status into st from public.provider_verification where provider_slug = pslug;
  if st = 'pending_review' then
    raise exception 'Your listing is under review. You can change categories once the review is done.';
  end if;

  if tg_op = 'INSERT' then
    select * into cat from public.service_categories where id = new.category_id;
    if cat.id is null or not cat.active or not cat.open_to_new_providers or cat.alias_of is not null then
      raise exception 'That category is not available';
    end if;
    if st = 'approved' and (cat.requires_licence or cat.enhanced_verification
         or cat.requires_business_registration or jsonb_array_length(cat.requirements) > 0) then
      raise exception 'That category needs extra checks. Contact support to add it to your listing.';
    end if;
    return new;
  end if;

  select * into cat from public.service_categories where id = old.category_id;
  if cat.slug = (select pr.category from public.providers pr where pr.slug = pslug) then
    raise exception 'That is your main category. Choose another main category first.';
  end if;
  if exists (select 1 from public.provider_services ps join public.category_services cs on cs.id = ps.service_id
             where ps.provider_slug = pslug and cs.category_id = old.category_id) then
    raise exception 'Remove your services in % first', cat.name;
  end if;
  return old;
end;
$$;
revoke execute on function public.enforce_provider_category() from public, anon, authenticated;
create trigger provider_categories_rules before insert or delete on public.provider_categories
  for each row execute function public.enforce_provider_category();

-- The main category (providers.category) is always one of the provider's categories.
create function public.sync_primary_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare cat public.service_categories;
begin
  select * into cat from public.service_categories where slug = new.category;
  if tg_op = 'UPDATE' and new.category is distinct from old.category
     and exists (select 1 from public.profiles where id = (select auth.uid()) and provider_slug = new.slug)
     and (not cat.active or not cat.open_to_new_providers or cat.alias_of is not null) then
    raise exception 'That category is not available';
  end if;
  perform set_config('pebble.sync_category', '1', true);
  insert into public.provider_categories (provider_slug, category_id) values (new.slug, cat.id)
    on conflict do nothing;
  perform set_config('pebble.sync_category', '0', true);
  return new;
end;
$$;
revoke execute on function public.sync_primary_category() from public, anon, authenticated;
create trigger providers_primary_category after insert or update of category on public.providers
  for each row execute function public.sync_primary_category();

-- 8. Bookings: category notice period ------------------------------------------------------------

create function public.enforce_category_notice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hrs integer;
  starts timestamp := new.scheduled_date + new.start_time;
begin
  select c.min_notice_hours into hrs
  from public.providers p
  left join public.provider_services ps on ps.provider_slug = p.slug and ps.name = new.service
  left join public.category_services cs on cs.id = ps.service_id
  join public.service_categories c on c.id = coalesce(cs.category_id, (select x.id from public.service_categories x where x.slug = p.category))
  where p.slug = new.provider_slug;
  if coalesce(hrs, 0) > 0 and starts < (now() at time zone 'Africa/Johannesburg') + make_interval(hours => hrs) then
    raise exception 'This service needs at least % hours notice', hrs;
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_category_notice() from public, anon, authenticated;
create trigger bookings_category_notice before insert on public.bookings
  for each row execute function public.enforce_category_notice();

-- 9. Verification: category requirements replace the hard-coded plumbing and electrical rule -------

create or replace function public.review_blockers(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.provider_verification;
  p public.providers;
  phone text;
  photos int;
  prov text[] := '{}';
  adm text[] := '{}';
  r record;
begin
  if not coalesce((select public.is_admin()) or p_slug = (select public.current_provider_slug()), false) then
    raise exception 'Not allowed';
  end if;
  select * into v from public.provider_verification where provider_slug = p_slug;
  select * into p from public.providers where slug = p_slug;
  if v.provider_slug is null then raise exception 'Provider not found'; end if;
  select pr.phone into phone from public.profiles pr where pr.provider_slug = p_slug;
  -- Only photos in this provider's own folder count.
  select count(distinct u) into photos from unnest(p.gallery || p.work) u
    where u !~ '^/images/' and u like '%/provider-photos/' || p_slug || '/%' and u not like '%..%';

  if char_length(btrim(p.about)) < 40
     or (select count(distinct c) from regexp_split_to_table(lower(btrim(p.about)), '') c) < 8 then
    prov := array_append(prov, 'Write a business description of at least 40 characters'::text);
  end if;
  if v.video_path = '' then
    prov := array_append(prov, 'Upload your intro video'::text);
  elsif v.video_path like '%..%' or not exists (
    select 1 from storage.objects o where o.bucket_id = 'provider-videos' and o.name = v.video_path) then
    prov := array_append(prov, 'Your intro video did not finish uploading. Upload it again'::text);
  end if;
  if photos < 3 then prov := array_append(prov, 'Upload at least 3 portfolio photos'::text); end if;
  if not exists (select 1 from public.provider_services where provider_slug = p_slug and from_price > 0) then
    prov := array_append(prov, 'Add at least one service with a price'::text);
  end if;
  if not exists (select 1 from public.provider_hours where provider_slug = p_slug and cardinality(times) > 0) then
    prov := array_append(prov, 'Set the hours you are available'::text);
  end if;
  if char_length(regexp_replace(coalesce(phone, ''), '\D', '', 'g')) < 9 then
    prov := array_append(prov, 'Add a valid phone number in your account settings'::text);
  end if;
  if not exists (
    select 1 from public.provider_documents d
    join storage.objects o on o.bucket_id = 'provider-docs' and o.name = d.path
    where d.provider_slug = p_slug and d.kind = 'id' and d.path not like '%..%') then
    prov := array_append(prov, 'Upload a copy of your ID'::text);
  end if;

  -- Licence, business registration and extra documents come from the provider's categories.
  if exists (select 1 from public.provider_categories pc join public.service_categories c on c.id = pc.category_id
             where pc.provider_slug = p_slug and c.requires_licence)
     and not exists (
       select 1 from public.provider_documents d
       join storage.objects o on o.bucket_id = 'provider-docs' and o.name = d.path
       where d.provider_slug = p_slug and d.kind in ('certification', 'qualification') and d.path not like '%..%') then
    prov := array_append(prov, 'Upload your trade certificate or registration'::text);
  end if;
  if exists (select 1 from public.provider_categories pc join public.service_categories c on c.id = pc.category_id
             where pc.provider_slug = p_slug and c.requires_business_registration)
     and not exists (
       select 1 from public.provider_documents d
       join storage.objects o on o.bucket_id = 'provider-docs' and o.name = d.path
       where d.provider_slug = p_slug and d.kind = 'business' and d.path not like '%..%') then
    prov := array_append(prov, 'Upload your business registration'::text);
  end if;
  for r in
    select distinct on (req->>'key') req->>'key' as key, req->>'label' as label, req->>'kind' as kind
    from public.provider_categories pc
    join public.service_categories c on c.id = pc.category_id
    cross join lateral jsonb_array_elements(c.requirements) req
    where pc.provider_slug = p_slug and coalesce((req->>'required')::boolean, true)
      and (req->>'kind') <> 'id'
    order by req->>'key'
  loop
    if not exists (
      select 1 from public.provider_documents d
      join storage.objects o on o.bucket_id = 'provider-docs' and o.name = d.path
      where d.provider_slug = p_slug and d.kind = r.kind and d.path not like '%..%') then
      prov := array_append(prov, ('Upload: ' || r.label)::text);
    end if;
  end loop;

  if not v.intro_video_reviewed then adm := array_append(adm, 'Intro video reviewed'::text); end if;
  if not v.portfolio_reviewed then adm := array_append(adm, 'Portfolio reviewed'::text); end if;
  if not v.contact_verified then adm := array_append(adm, 'Contact details verified'::text); end if;
  if not v.business_verified then adm := array_append(adm, 'Business info verified'::text); end if;
  if not v.category_requirements_met then adm := array_append(adm, 'Category requirements met'::text); end if;
  if not v.documents_checked then adm := array_append(adm, 'Documents checked'::text); end if;

  return jsonb_build_object('provider', to_jsonb(prov), 'admin', to_jsonb(adm));
end;
$$;

-- Experience and skills freeze with the rest of the listing while it is under review.
create or replace function public.lock_listing_after_submit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare st text;
begin
  if not exists (select 1 from public.profiles
                 where id = (select auth.uid()) and provider_slug = old.slug) then
    return new;
  end if;
  select status into st from public.provider_verification where provider_slug = old.slug;
  if st = 'pending_review' and (
       new.name is distinct from old.name or new.category is distinct from old.category
       or new.about is distinct from old.about or new.tagline is distinct from old.tagline
       or new.area is distinct from old.area or new.city is distinct from old.city
       or new.experience is distinct from old.experience or new.skills is distinct from old.skills
       or new.gallery is distinct from old.gallery or new.work is distinct from old.work) then
    raise exception 'Your listing is under review. You can edit it again once the review is done.';
  end if;
  if st = 'approved' and new.category is distinct from old.category then
    raise exception 'To change your category, contact support so your listing can be re-checked.';
  end if;
  return new;
end;
$$;

-- Extra documents are protected like ID and certificates once the listing is under review or live.
create or replace function public.lock_documents_after_submit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare st text;
begin
  if pg_trigger_depth() > 1 then return old; end if;
  if exists (select 1 from public.profiles
             where id = (select auth.uid()) and provider_slug = old.provider_slug) then
    select status into st from public.provider_verification where provider_slug = old.provider_slug;
    if st in ('pending_review', 'approved') and old.kind <> 'business' then
      raise exception 'Documents cannot be removed while your listing is under review or live.';
    end if;
  end if;
  return old;
end;
$$;

-- 10. Creating a listing and choosing categories ------------------------------------------------

create or replace function public.create_my_listing(p_name text, p_category text, p_area text, p_city text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  base text;
  candidate text;
  cat public.service_categories;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if not exists (
    select 1 from public.profiles where id = uid and role = 'provider' and provider_slug is null
  ) then
    raise exception 'This account cannot create a listing';
  end if;

  select * into cat from public.service_categories where slug = p_category;
  if cat.id is null or not cat.active or not cat.open_to_new_providers or cat.alias_of is not null then
    raise exception 'That category is not available';
  end if;

  base := trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'));
  if char_length(base) < 3 then base := 'provider'; end if;
  base := left(base, 50);
  candidate := base;
  while exists (select 1 from public.providers where slug = candidate) loop
    candidate := base || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.providers (slug, name, category, area, city, image, gallery, work)
  values (candidate, trim(p_name), cat.slug, trim(p_area), trim(p_city), cat.image, array[cat.image], array[cat.image]);

  insert into public.provider_hours (provider_slug, weekday, times)
  select candidate, d,
    case when d between 1 and 5 then array['08:00','10:00','12:00','14:00','16:00']
         when d = 6 then array['08:00','10:00'] else '{}'::text[] end
  from generate_series(0, 6) d;

  update public.profiles set provider_slug = candidate where id = uid;
  return candidate;
end;
$$;

-- Choose one or more categories. The main category (providers.category) is changed on the listing
-- itself and always stays in the list.
create function public.set_my_categories(p_slugs text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me text := (select public.current_provider_slug());
  st text;
  s text;
  cat public.service_categories;
  main_cat text;
begin
  if me is null then raise exception 'Create your listing first'; end if;
  if p_slugs is null or cardinality(p_slugs) = 0 or cardinality(p_slugs) > 6 then
    raise exception 'Choose between one and six categories';
  end if;
  select status into st from public.provider_verification where provider_slug = me;
  if st = 'pending_review' then
    raise exception 'Your listing is under review. You can change categories once the review is done.';
  end if;
  select category into main_cat from public.providers where slug = me;

  foreach s in array p_slugs loop
    select * into cat from public.service_categories where slug = s;
    if cat.id is null then raise exception 'That category is not available'; end if;
    if not exists (select 1 from public.provider_categories where provider_slug = me and category_id = cat.id) then
      insert into public.provider_categories (provider_slug, category_id) values (me, cat.id);
    end if;
  end loop;

  -- Anything not in the list goes, except the main category.
  for cat in
    select c.* from public.provider_categories pc join public.service_categories c on c.id = pc.category_id
    where pc.provider_slug = me and c.slug <> all (p_slugs) and c.slug <> main_cat
  loop
    delete from public.provider_categories where provider_slug = me and category_id = cat.id;
  end loop;
end;
$$;
revoke execute on function public.set_my_categories(text[]) from public, anon;
grant execute on function public.set_my_categories(text[]) to authenticated;

-- 11. Reading the catalogue ------------------------------------------------------------------------

-- Categories for browsing: only active ones not replaced by another, and old ones only while they
-- have providers. Includes active services and how many live providers offer the category.
create function public.browse_categories()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x.obj order by x.sort_order, x.name), '[]') from (
    select c.sort_order, c.name, jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'name', c.name, 'description', c.description, 'icon', c.icon, 'image', c.image,
      'allow_instant_booking', c.allow_instant_booking, 'enhanced_verification', c.enhanced_verification,
      'providers', (select count(distinct pc.provider_slug) from public.provider_categories pc
                    join public.providers p on p.slug = pc.provider_slug and p.active
                    where pc.category_id = c.id and exists (select 1 from public.provider_services s
                                                            where s.provider_slug = p.slug and s.active)),
      'services', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'description', s.description,
                       'suggested_duration_minutes', s.suggested_duration_minutes) order by s.sort_order, s.name), '[]')
                   from public.category_services s where s.category_id = c.id and s.active)) as obj
    from public.service_categories c
    where c.active and c.alias_of is null
      and (not c.is_legacy or exists (select 1 from public.provider_categories pc
                                      join public.providers p on p.slug = pc.provider_slug and p.active
                                      where pc.category_id = c.id))
  ) x
$$;
revoke execute on function public.browse_categories() from public;
grant execute on function public.browse_categories() to anon, authenticated;

-- Categories a provider can choose today, with their services and rules.
create function public.selectable_categories()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'name', c.name, 'description', c.description, 'icon', c.icon,
    'allow_instant_booking', c.allow_instant_booking, 'requires_licence', c.requires_licence,
    'enhanced_verification', c.enhanced_verification,
    'requires_business_registration', c.requires_business_registration,
    'min_notice_hours', c.min_notice_hours, 'max_duration_minutes', c.max_duration_minutes,
    'requirements', c.requirements,
    'services', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'description', s.description,
                    'suggested_duration_minutes', s.suggested_duration_minutes) order by s.sort_order, s.name), '[]')
                 from public.category_services s where s.category_id = c.id and s.active)
  ) order by c.sort_order, c.name), '[]')
  from public.service_categories c
  where c.active and c.open_to_new_providers and c.alias_of is null
$$;
revoke execute on function public.selectable_categories() from public;
grant execute on function public.selectable_categories() to anon, authenticated;

-- 12. Admin management ----------------------------------------------------------------------------

create function public.log_category_event(p_category uuid, p_service uuid, p_kind text, p_detail jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.category_events (category_id, service_id, kind, detail, actor)
  values (p_category, p_service, p_kind, p_detail, (select auth.uid()))
$$;
revoke execute on function public.log_category_event(uuid, uuid, text, jsonb) from public, anon, authenticated;

create function public.admin_category_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object(
      'providers_total', (select count(distinct pc.provider_slug) from public.provider_categories pc where pc.category_id = c.id),
      'providers_live', (select count(distinct pc.provider_slug) from public.provider_categories pc
                         join public.providers p on p.slug = pc.provider_slug and p.active where pc.category_id = c.id),
      'services', (select coalesce(jsonb_agg(to_jsonb(s) || jsonb_build_object(
                      'providers', (select count(distinct ps.provider_slug) from public.provider_services ps where ps.service_id = s.id))
                   order by s.sort_order, s.name), '[]')
                   from public.category_services s where s.category_id = c.id)
    ) order by c.sort_order, c.name), '[]')
    from public.service_categories c);
end;
$$;
revoke execute on function public.admin_category_overview() from public, anon;
grant execute on function public.admin_category_overview() to authenticated;

-- Create (no id) or edit (id) a category. New categories start inactive.
create function public.admin_save_category(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  nm text := btrim(coalesce(p->>'name', ''));
  base text;
  cid uuid := p_id;
  s text;
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  if char_length(nm) < 2 then raise exception 'Enter a category name'; end if;
  if p ? 'requirements' and not public.valid_category_requirements(p->'requirements') then
    raise exception 'The verification requirements are not valid';
  end if;

  if cid is null then
    base := trim(both '-' from regexp_replace(lower(coalesce(nullif(btrim(p->>'slug'), ''), nm)), '[^a-z0-9]+', '-', 'g'));
    if char_length(base) < 3 then raise exception 'Choose a longer name'; end if;
    s := left(base, 56);
    while exists (select 1 from public.service_categories where slug = s) loop
      s := left(base, 50) || '-' || substr(md5(random()::text), 1, 4);
    end loop;
    insert into public.service_categories (slug, name, description, icon, image, sort_order, active,
        allow_instant_booking, requires_licence, enhanced_verification, requires_business_registration,
        min_notice_hours, max_duration_minutes, requirements)
    values (s, nm, left(coalesce(p->>'description', ''), 300), coalesce(nullif(p->>'icon', ''), 'sparkles'),
        coalesce(nullif(p->>'image', ''), '/images/room-living.jpg'), coalesce((p->>'sort_order')::integer, 200), false,
        coalesce((p->>'allow_instant_booking')::boolean, true), coalesce((p->>'requires_licence')::boolean, false),
        coalesce((p->>'enhanced_verification')::boolean, false), coalesce((p->>'requires_business_registration')::boolean, false),
        coalesce((p->>'min_notice_hours')::integer, 0), (p->>'max_duration_minutes')::integer,
        coalesce(p->'requirements', '[]'))
    returning id into cid;
    perform public.log_category_event(cid, null, 'category_created', jsonb_build_object('name', nm));
  else
    update public.service_categories c set
      name = nm,
      description = case when p ? 'description' then left(p->>'description', 300) else c.description end,
      icon = case when p ? 'icon' then coalesce(nullif(p->>'icon', ''), c.icon) else c.icon end,
      image = case when p ? 'image' then coalesce(nullif(p->>'image', ''), c.image) else c.image end,
      sort_order = case when p ? 'sort_order' then (p->>'sort_order')::integer else c.sort_order end,
      allow_instant_booking = case when p ? 'allow_instant_booking' then (p->>'allow_instant_booking')::boolean else c.allow_instant_booking end,
      requires_licence = case when p ? 'requires_licence' then (p->>'requires_licence')::boolean else c.requires_licence end,
      enhanced_verification = case when p ? 'enhanced_verification' then (p->>'enhanced_verification')::boolean else c.enhanced_verification end,
      requires_business_registration = case when p ? 'requires_business_registration' then (p->>'requires_business_registration')::boolean else c.requires_business_registration end,
      min_notice_hours = case when p ? 'min_notice_hours' then (p->>'min_notice_hours')::integer else c.min_notice_hours end,
      max_duration_minutes = case when p ? 'max_duration_minutes' then (p->>'max_duration_minutes')::integer else c.max_duration_minutes end,
      requirements = case when p ? 'requirements' then p->'requirements' else c.requirements end
    where c.id = cid;
    if not found then raise exception 'Category not found'; end if;
    perform public.log_category_event(cid, null, 'category_edited', p - 'requirements');
  end if;
  return cid;
exception when unique_violation then
  raise exception 'A category with that name already exists';
end;
$$;
revoke execute on function public.admin_save_category(uuid, jsonb) from public, anon;
grant execute on function public.admin_save_category(uuid, jsonb) to authenticated;

create function public.admin_set_category_active(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  if p_active and not exists (select 1 from public.category_services where category_id = p_id and active) then
    raise exception 'Add at least one active service before turning a category on';
  end if;
  update public.service_categories set active = p_active where id = p_id;
  if not found then raise exception 'Category not found'; end if;
  perform public.log_category_event(p_id, null, case when p_active then 'category_activated' else 'category_deactivated' end, '{}');
end;
$$;
revoke execute on function public.admin_set_category_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_category_active(uuid, boolean) to authenticated;

-- Add (no id) or rename and edit (id) a service inside a category.
create function public.admin_save_category_service(
  p_id uuid, p_category uuid, p_name text, p_description text, p_duration integer, p_sort integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare sid uuid := p_id;
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'Enter a service name'; end if;
  if sid is null then
    insert into public.category_services (category_id, name, description, suggested_duration_minutes, sort_order)
    values (p_category, btrim(p_name), left(coalesce(p_description, ''), 200), coalesce(p_duration, 60), coalesce(p_sort, 200))
    returning id into sid;
    perform public.log_category_event(p_category, sid, 'service_created', jsonb_build_object('name', btrim(p_name)));
  else
    update public.category_services set name = btrim(p_name), description = left(coalesce(p_description, ''), 200),
        suggested_duration_minutes = coalesce(p_duration, suggested_duration_minutes), sort_order = coalesce(p_sort, sort_order)
    where id = sid returning category_id into p_category;
    if not found then raise exception 'Service not found'; end if;
    perform public.log_category_event(p_category, sid, 'service_edited', jsonb_build_object('name', btrim(p_name)));
  end if;
  return sid;
exception when unique_violation then
  raise exception 'That category already has a service with this name';
end;
$$;
revoke execute on function public.admin_save_category_service(uuid, uuid, text, text, integer, integer) from public, anon;
grant execute on function public.admin_save_category_service(uuid, uuid, text, text, integer, integer) to authenticated;

create function public.admin_set_category_service_active(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare cid uuid;
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  update public.category_services set active = p_active where id = p_id returning category_id into cid;
  if not found then raise exception 'Service not found'; end if;
  perform public.log_category_event(cid, p_id, case when p_active then 'service_activated' else 'service_deactivated' end, '{}');
end;
$$;
revoke execute on function public.admin_set_category_service_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_category_service_active(uuid, boolean) to authenticated;
