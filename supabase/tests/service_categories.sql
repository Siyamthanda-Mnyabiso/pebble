create function pg_temp.as_user(u uuid) returns void language plpgsql as $f$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role','authenticated')::text, true); execute 'set local role authenticated'; end $f$;
create function pg_temp.as_anon() returns void language plpgsql as $f$
begin perform set_config('request.jwt.claims', '', true); execute 'set local role anon'; end $f$;
create function pg_temp.as_owner() returns void language plpgsql as $f$
begin execute 'reset role'; perform set_config('request.jwt.claims','',true); end $f$;
-- Entries in the customer category list that belong to the new catalogue (old categories only show while they have providers).
create function pg_temp.browse_new() returns int language sql as $f$
  select count(*)::int from jsonb_to_recordset(public.browse_categories()) as t(slug text)
  join public.service_categories c on c.slug = t.slug where not c.is_legacy $f$;
create function pg_temp.chk(label text, cond boolean) returns text language sql as $f$
  select E'\n' || case when coalesce(cond, false) then 'ok   ' else 'BAD  ' end || label $f$;
-- Runs a statement and returns its error text, or null when it succeeded.
create function pg_temp.fails(q text) returns text language plpgsql as $f$
begin execute q; return null; exception when others then return sqlerrm; end $f$;

do $$
declare
  o uuid := gen_random_uuid(); o2 uuid := gen_random_uuid(); c uuid := gen_random_uuid(); a uuid := gen_random_uuid();
  sl text; sl2 text; r text := ''; e text; n int; k int; pre record; post record;
  d date := current_date + 3; garden uuid; pets uuid; clean uuid; kids uuid; newcat uuid; newsvc uuid;
  s_grass uuid; s_garden uuid; s_dog uuid; s_clean uuid; s_hedge uuid; s_kid uuid; b1 uuid; b2 uuid; b3 uuid; js jsonb;
begin
  -- 0 existing providers, services and bookings are untouched by the migration
  if to_regclass('pg_temp.pre_snapshot') is not null then
    select * into pre from pg_temp.pre_snapshot;
    select
     (select md5(coalesce(string_agg(p.slug||p.category||p.name||p.active::text||p.verified::text, ',' order by p.slug), '')) from public.providers p) providers_md5,
     (select md5(coalesce(string_agg(id::text||provider_slug||name||from_price||duration_minutes||instant_booking::text||active::text, ',' order by id), '')) from public.provider_services) services_md5,
     (select md5(coalesce(string_agg(id::text||status::text||service||price_cents||commission_cents||earning_cents, ',' order by id), '')) from public.bookings) bookings_md5,
     (select count(*) from public.providers) n_providers, (select count(*) from public.provider_services) n_services, (select count(*) from public.bookings) n_bookings
     into post;
    r := r || pg_temp.chk('0 providers unchanged (' || post.n_providers || ')', pre.providers_md5 = post.providers_md5 and pre.n_providers = post.n_providers);
    r := r || pg_temp.chk('0 provider services unchanged (' || post.n_services || ')', pre.services_md5 = post.services_md5 and pre.n_services = post.n_services);
    r := r || pg_temp.chk('0 bookings unchanged (' || post.n_bookings || ')', pre.bookings_md5 = post.bookings_md5 and pre.n_bookings = post.n_bookings);
  else
    r := r || E'\n--   (no pre snapshot: run with the .pre.sql file to prove existing data is unchanged)';
  end if;
  select coalesce(bool_and(exists (select 1 from public.provider_categories pc join public.service_categories c on c.id = pc.category_id
                          where pc.provider_slug = p.slug and c.slug = p.category)), true) into e from public.providers p;
  r := r || pg_temp.chk('0 every existing provider belongs to its own category', e::boolean);
  select count(*) into n from public.provider_services where service_id is not null;
  r := r || E'\n--   existing services linked to the catalogue by name: ' || n;

  -- 1 the six launch categories and their services
  select count(*) into n from public.service_categories where active and not is_legacy;
  r := r || pg_temp.chk('1 six active launch categories (' || n || ')', n = 6);
  select string_agg(c.slug || '=' || (select count(*) from public.category_services s where s.category_id = c.id), ', ' order by c.sort_order) into e
    from public.service_categories c where c.active and not c.is_legacy;
  r := r || pg_temp.chk('1 service counts ' || e, e = 'gardening-outdoor-care=6, home-cleaning=6, car-washing-detailing=5, pet-care=4, tutoring-education=5, handyman-home-assistance=5');
  select count(*) into n from public.category_services s join public.service_categories c on c.id = s.category_id where c.active and not c.is_legacy and s.active;
  r := r || pg_temp.chk('1 all 31 launch services active (' || n || ')', n = 31);
  select count(*) into n from public.service_categories
    where slug in ('babysitting-childcare','beauty-personal-care','event-assistance','technology-assistance','professional-trades') and not active;
  r := r || pg_temp.chk('1 the five future categories are present and inactive (' || n || ')', n = 5);
  select (enhanced_verification and not allow_instant_booking and jsonb_array_length(requirements) = 4 and not active)::text into e
    from public.service_categories where slug = 'babysitting-childcare';
  r := r || pg_temp.chk('1 childcare: enhanced verification, no instant booking, 4 requirements, inactive', e::boolean);
  select (requires_licence and requires_business_registration and not active)::text into e from public.service_categories where slug = 'professional-trades';
  r := r || pg_temp.chk('1 professional trades: licence required, inactive', e::boolean);
  select (allow_instant_booking = false)::text into e from public.service_categories where slug = 'pet-care';
  r := r || pg_temp.chk('1 pet care is manual approval only', e::boolean);
  select count(*) into n from public.service_categories where slug in ('plumbing','electrical') and requires_licence;
  r := r || pg_temp.chk('1 plumbing and electrical keep their licence rule through the flag', n = 2);
  select count(*) into n from public.service_categories where alias_of is not null;
  r := r || pg_temp.chk('1 four old categories point at their replacement (' || n || ')', n = 4);
  e := pg_temp.fails($q$update public.service_categories set slug = 'changed-slug' where slug = 'pet-care'$q$);
  r := r || pg_temp.chk('1 category slug cannot change', e like '%cannot change%');
  e := pg_temp.fails($q$insert into public.category_services (category_id, name) select id, 'Dog Walking' from public.service_categories where slug = 'pet-care'$q$);
  r := r || pg_temp.chk('1 duplicate service name in a category refused (case-insensitive)', e is not null);

  insert into auth.users (id, instance_id, aud, role, email) values
   (o,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','sc-p@test.invalid'),
   (o2,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','sc-p2@test.invalid'),
   (c,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','sc-c@test.invalid'),
   (a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','sc-a@test.invalid');
  update public.profiles set role='provider', phone='0821234567' where id in (o, o2);
  update public.profiles set is_admin = true where id = a;
  select id into garden from public.service_categories where slug = 'gardening-outdoor-care';
  select id into pets from public.service_categories where slug = 'pet-care';
  select id into clean from public.service_categories where slug = 'home-cleaning';
  select id into kids from public.service_categories where slug = 'babysitting-childcare';
  select s.id into s_grass from public.category_services s where s.category_id = garden and s.name = 'Grass cutting';
  select s.id into s_garden from public.category_services s where s.category_id = garden and s.name = 'Garden maintenance';
  select s.id into s_hedge from public.category_services s where s.category_id = garden and s.name = 'Hedge trimming';
  select s.id into s_dog from public.category_services s where s.category_id = pets and s.name = 'Dog walking';
  select s.id into s_clean from public.category_services s where s.category_id = clean and s.name = 'General house cleaning';

  -- 2 onboarding: choosing a category
  perform pg_temp.as_user(o2);
  e := pg_temp.fails($q$select public.create_my_listing('Old Style Co', 'cleaning', 'Gardens', 'Cape Town')$q$);
  r := r || pg_temp.chk('2 an old category is closed to new providers: ' || left(coalesce(e,'accepted'),40), e like '%not available%');
  e := pg_temp.fails($q$select public.create_my_listing('Kids Co', 'babysitting-childcare', 'Gardens', 'Cape Town')$q$);
  r := r || pg_temp.chk('2 an inactive category cannot be chosen: ' || left(coalesce(e,'accepted'),40), e like '%not available%');
  e := pg_temp.fails($q$select public.create_my_listing('Nope Co', 'no-such-category', 'Gardens', 'Cape Town')$q$);
  r := r || pg_temp.chk('2 an unknown category cannot be chosen', e like '%not available%');
  js := public.selectable_categories();
  r := r || pg_temp.chk('2 provider is offered exactly the six launch categories (' || jsonb_array_length(js) || ')', jsonb_array_length(js) = 6);
  perform pg_temp.as_user(o);
  sl := public.create_my_listing('Green Test Co', 'gardening-outdoor-care', 'Gardens', 'Cape Town');
  perform pg_temp.as_owner();
  select count(*) into n from public.provider_categories where provider_slug = sl;
  r := r || pg_temp.chk('2 main category is also in provider_categories (' || n || ')', n = 1);

  -- 3 choosing services
  perform pg_temp.as_user(o);
  e := pg_temp.fails(format('insert into public.provider_services (provider_slug, name, from_price) values (%L, ''Free text'', 100)', sl));
  r := r || pg_temp.chk('3 free-text service refused for a catalogue provider: ' || left(coalesce(e,'accepted'),40), e like '%Choose your service%');
  e := pg_temp.fails(format('insert into public.provider_services (provider_slug, name, from_price, service_id) values (%L, ''x'', 100, %L)', sl, s_clean));
  r := r || pg_temp.chk('3 service from a category not chosen refused: ' || left(coalesce(e,'accepted'),40), e like '%Add the%');
  e := pg_temp.fails(format('insert into public.provider_services (provider_slug, name, from_price, service_id, duration_minutes) values (%L, ''Whatever name'', 250, %L, 90)', sl, s_grass));
  r := r || pg_temp.chk('3 catalogue service accepted with the provider''s own price and duration: ' || coalesce(left(e,40), 'ok'), e is null);
  perform pg_temp.as_owner();
  select name into e from public.provider_services where provider_slug = sl and service_id = s_grass;
  r := r || pg_temp.chk('3 name is taken from the catalogue (' || e || ')', e = 'Grass cutting');
  perform pg_temp.as_user(o);
  e := pg_temp.fails(format('update public.provider_services set instant_booking = true where provider_slug = %L', sl));
  r := r || pg_temp.chk('3 instant booking allowed where the category permits it: ' || coalesce(left(e,40), 'ok'), e is null);
  e := pg_temp.fails(format('update public.provider_services set name = ''Renamed by me'' where provider_slug = %L', sl));
  perform pg_temp.as_owner();
  select name into e from public.provider_services where provider_slug = sl and service_id = s_grass;
  r := r || pg_temp.chk('3 a provider cannot rename a catalogue service', e = 'Grass cutting');
  perform pg_temp.as_user(o);
  e := pg_temp.fails(format('update public.providers set experience = ''Ten years of lawns and hedges'', skills = array[''Lawns'',''Hedges''] where slug = %L', sl));
  r := r || pg_temp.chk('3 provider can describe experience and skills: ' || coalesce(left(e,40), 'ok'), e is null);
  perform pg_temp.as_owner();

  -- 4 several categories, instant booking only where permitted
  perform pg_temp.as_user(o);
  perform public.set_my_categories(array['gardening-outdoor-care', 'pet-care']);
  perform pg_temp.as_owner();
  select count(*) into n from public.provider_categories where provider_slug = sl;
  r := r || pg_temp.chk('4 provider selected two categories (' || n || ')', n = 2);
  perform pg_temp.as_user(o);
  e := pg_temp.fails(format('insert into public.provider_services (provider_slug, name, from_price, service_id, instant_booking) values (%L, ''x'', 150, %L, true)', sl, s_dog));
  r := r || pg_temp.chk('4 instant booking refused where the category forbids it: ' || left(coalesce(e,'accepted'),50), e like '%Instant booking is not available%');
  e := pg_temp.fails(format('insert into public.provider_services (provider_slug, name, from_price, service_id) values (%L, ''x'', 150, %L)', sl, s_dog));
  r := r || pg_temp.chk('4 the same service with manual approval is accepted', e is null);
  e := pg_temp.fails($q$select public.set_my_categories(array['gardening-outdoor-care'])$q$);
  r := r || pg_temp.chk('4 cannot drop a category that still has services: ' || left(coalesce(e,'accepted'),50), e like '%Remove your services%');
  e := pg_temp.fails($q$select public.set_my_categories(array['babysitting-childcare'])$q$);
  r := r || pg_temp.chk('4 cannot add an inactive category', e like '%not available%');
  perform pg_temp.as_user(o2);
  sl2 := public.create_my_listing('Pet Test Co', 'pet-care', 'Gardens', 'Cape Town');
  e := pg_temp.fails(format('insert into public.provider_categories (provider_slug, category_id) values (%L, %L)', sl, clean));
  r := r || pg_temp.chk('4 another provider cannot change my categories', e is not null);
  perform pg_temp.as_owner();

  -- 5 category management is for admins only, in the database
  perform pg_temp.as_user(o);
  e := pg_temp.fails($q$insert into public.service_categories (slug, name) values ('sneaky-cat', 'Sneaky')$q$);
  r := r || pg_temp.chk('5 provider cannot insert a category', e is not null);
  e := pg_temp.fails($q$update public.service_categories set active = false where slug = 'pet-care'$q$);
  r := r || pg_temp.chk('5 provider cannot change a category', e is not null);
  e := pg_temp.fails($q$insert into public.category_services (category_id, name) select id, 'Sneaky' from public.service_categories limit 1$q$);
  r := r || pg_temp.chk('5 provider cannot add a catalogue service', e is not null);
  e := pg_temp.fails($q$select public.admin_save_category(null, '{"name":"Sneaky"}')$q$);
  r := r || pg_temp.chk('5 provider cannot call the admin category function: ' || left(coalesce(e,'accepted'),30), e like '%Not allowed%');
  e := pg_temp.fails($q$select public.admin_set_category_active((select id from public.service_categories where slug='pet-care'), false)$q$);
  r := r || pg_temp.chk('5 provider cannot switch a category off', e like '%Not allowed%');
  e := pg_temp.fails($q$select public.admin_category_overview()$q$);
  r := r || pg_temp.chk('5 provider cannot read the admin overview', e like '%Not allowed%');
  select count(*) into n from public.service_categories where slug = 'babysitting-childcare';
  r := r || pg_temp.chk('5 provider cannot see an inactive future category', n = 0);
  perform pg_temp.as_anon();
  select count(*) into n from public.service_categories where not active and not is_legacy;
  k := pg_temp.browse_new();
  r := r || pg_temp.chk('5 visitors see no inactive categories (' || n || ') and browse six (' || k || ')', n = 0 and k = 6);
  perform pg_temp.as_user(a);
  select count(*) into n from public.service_categories where not active and not is_legacy;
  r := r || pg_temp.chk('5 admin sees the inactive categories too (' || n || ')', n = 5);
  perform pg_temp.as_owner();

  -- 6 admin: create a category, services, activation
  perform pg_temp.as_user(a);
  newcat := public.admin_save_category(null, '{"name":"Sewing & Alterations","description":"Hems and repairs","icon":"scissors","allow_instant_booking":false,"min_notice_hours":24}');
  e := pg_temp.fails(format('select public.admin_set_category_active(%L, true)', newcat));
  r := r || pg_temp.chk('6 a new category starts off and cannot be switched on without a service: ' || left(coalesce(e,'accepted'),30), e like '%at least one active service%');
  newsvc := public.admin_save_category_service(null, newcat, 'Hemming', 'Trousers and skirts', 45, 10);
  perform public.admin_save_category_service(null, newcat, 'Zip replacement', '', 60, 20);
  perform public.admin_set_category_active(newcat, true);
  js := public.browse_categories();
  r := r || pg_temp.chk('6 the new category appears for customers with no code change', js @> '[{"slug":"sewing-alterations"}]'::jsonb);
  r := r || pg_temp.chk('6 browse now lists seven new categories (' || pg_temp.browse_new() || ')', pg_temp.browse_new() = 7);
  e := pg_temp.fails($q$select public.admin_save_category(null, '{"name":"sewing & alterations"}')$q$);
  r := r || pg_temp.chk('6 duplicate category name refused: ' || left(coalesce(e,'accepted'),40), e like '%already exists%');
  e := pg_temp.fails(format('select public.admin_save_category_service(null, %L, ''HEMMING'', '''', 30, 1)', newcat));
  r := r || pg_temp.chk('6 duplicate service name refused', e like '%already has a service%');
  e := pg_temp.fails($q$select public.admin_save_category(null, '{"name":"Bad reqs","requirements":[{"key":"x","label":"Thing","kind":"nonsense"}]}')$q$);
  r := r || pg_temp.chk('6 invalid verification requirements refused', e like '%not valid%');
  select t.providers_total || '/' || t.providers_live into e
    from jsonb_to_recordset(public.admin_category_overview()) as t(slug text, providers_total int, providers_live int) where t.slug = 'gardening-outdoor-care';
  r := r || pg_temp.chk('6 admin sees provider counts per category (gardening ' || e || ')', e = (select count(*) || '/' || count(*) filter (where p.active)
    from public.providers p where p.category in ('gardening', 'gardening-outdoor-care')));
  select count(*) into n from public.category_events;
  r := r || pg_temp.chk('6 changes are logged (' || n || ' events)', n >= 4);
  perform pg_temp.as_owner();

  -- a live provider with hours so bookings can be tested
  perform pg_temp.as_user(o);
  insert into public.provider_services (provider_slug, name, from_price, service_id, duration_minutes, instant_booking)
    values (sl, 'x', 180, s_garden, 120, true);
  perform pg_temp.as_owner();
  insert into public.provider_hours (provider_slug, weekday, times) select sl, g, array['08:00','10:00','12:00'] from generate_series(0,6) g
    on conflict (provider_slug, weekday) do update set times = excluded.times;
  update public.provider_verification set status = 'approved' where provider_slug = sl;
  perform pg_temp.as_user(c);
  insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents)
    values ('SC-1', c, sl, 'Grass cutting', d, '08:00', '1 Long Street, Cape Town', 1) returning id into b1;
  perform pg_temp.as_owner();
  select (price_cents = 25000 and commission_pct = 10 and fee_cents = 0)::text into e from public.bookings where id = b1;
  r := r || pg_temp.chk('6 booking through the existing flow: provider price, 10% commission, R0 customer fee', e::boolean);

  -- 7 category rules reach services and bookings
  perform pg_temp.as_user(a);
  perform public.admin_save_category(garden, '{"name":"Gardening & Outdoor Care","allow_instant_booking":false}');
  perform pg_temp.as_owner();
  select count(*) into n from public.provider_services where provider_slug = sl and instant_booking;
  r := r || pg_temp.chk('7 turning instant booking off for a category sends its services to manual approval (' || n || ' still instant)', n = 0);
  perform pg_temp.as_user(o);
  e := pg_temp.fails(format('update public.provider_services set instant_booking = true where provider_slug = %L and service_id = %L', sl, s_grass));
  r := r || pg_temp.chk('7 and the provider cannot turn it back on', e like '%Instant booking is not available%');
  perform pg_temp.as_user(a);
  perform public.admin_save_category(garden, '{"name":"Gardening & Outdoor Care","allow_instant_booking":true,"max_duration_minutes":100,"min_notice_hours":96}');
  perform pg_temp.as_user(o);
  e := pg_temp.fails(format('insert into public.provider_services (provider_slug, name, from_price, service_id, duration_minutes) values (%L, ''x'', 200, %L, 120)', sl, s_hedge));
  r := r || pg_temp.chk('7 maximum duration enforced: ' || left(coalesce(e,'accepted'),40), e like '%at most 100%');
  perform pg_temp.as_user(c);
  e := pg_temp.fails(format('insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents) values (''SC-2'', %L, %L, ''Grass cutting'', %L, ''10:00'', ''1 Long Street'', 1)', c, sl, d));
  r := r || pg_temp.chk('7 notice period enforced on bookings: ' || left(coalesce(e,'accepted'),40), e like '%hours notice%');
  perform pg_temp.as_user(a);
  perform public.admin_save_category(garden, '{"name":"Gardening & Outdoor Care","max_duration_minutes":null,"min_notice_hours":0}');
  perform pg_temp.as_owner();

  -- 8 renaming a service reaches providers but never past bookings
  perform pg_temp.as_user(a);
  perform public.admin_save_category_service(s_grass, garden, 'Lawn mowing', 'Cut and edge', 90, 10);
  perform pg_temp.as_owner();
  select name into e from public.provider_services where provider_slug = sl and service_id = s_grass;
  r := r || pg_temp.chk('8 renamed service shows the new name to providers (' || e || ')', e = 'Lawn mowing');
  select service into e from public.bookings where id = b1;
  r := r || pg_temp.chk('8 the past booking keeps the name it was made with (' || e || ')', e = 'Grass cutting');
  perform pg_temp.as_user(c);
  insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents)
    values ('SC-3', c, sl, 'Lawn mowing', d, '10:00', '1 Long Street, Cape Town', 1) returning id into b2;
  perform pg_temp.as_owner();
  r := r || pg_temp.chk('8 a booking under the new name works', b2 is not null);

  -- 9 deactivating is soft: nothing is lost and existing work carries on
  select count(*) into k from public.provider_services where provider_slug = sl;
  perform pg_temp.as_user(a);
  perform public.admin_set_category_service_active(s_garden, false);
  perform pg_temp.as_user(o2);
  perform public.set_my_categories(array['pet-care', 'gardening-outdoor-care']);
  e := pg_temp.fails(format('insert into public.provider_services (provider_slug, name, from_price, service_id) values (%L, ''x'', 150, %L)', sl2, s_garden));
  r := r || pg_temp.chk('9 a deactivated service cannot be newly selected: ' || left(coalesce(e,'accepted'),40), e like '%not available%');
  perform pg_temp.as_owner();
  select count(*) into n from public.provider_services where provider_slug = sl and service_id = s_garden and active;
  r := r || pg_temp.chk('9 providers who already offer it keep it', n = 1);
  select jsonb_array_length(s.services) into n from jsonb_to_recordset(public.browse_categories()) as s(slug text, services jsonb) where s.slug = 'gardening-outdoor-care';
  r := r || pg_temp.chk('9 and customers browsing no longer see it listed (' || n || ' services)', n = 5);

  perform pg_temp.as_user(a);
  perform public.admin_set_category_active(garden, false);
  perform pg_temp.as_owner();
  select count(*) into n from public.provider_services where provider_slug = sl;
  r := r || pg_temp.chk('9 category off: provider services all still there (' || n || ' of ' || k || ')', n = k);
  select (active)::text into e from public.providers where slug = sl;
  r := r || pg_temp.chk('9 category off: the provider is still live', e::boolean);
  perform pg_temp.as_user(c);
  insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents)
    values ('SC-4', c, sl, 'Lawn mowing', d, '12:00', '1 Long Street, Cape Town', 1) returning id into b3;
  r := r || pg_temp.chk('9 category off: customers can still book the existing provider', b3 is not null);
  perform pg_temp.as_anon();
  k := pg_temp.browse_new();
  select count(*) into n from public.service_categories where slug = 'gardening-outdoor-care';
  r := r || pg_temp.chk('9 category off: hidden from browsing (' || k || ' listed) but its label still resolves for live providers', k = 6 and n = 1);
  perform pg_temp.as_owner();
  update public.profiles set provider_slug = null where id = o2;
  -- (relinked right after the check)
  perform pg_temp.as_user(o2);
  e := pg_temp.fails($q$select public.create_my_listing('Late Garden Co', 'gardening-outdoor-care', 'Gardens', 'Cape Town')$q$);
  r := r || pg_temp.chk('9 category off: closed to new listings', e like '%not available%');
  perform pg_temp.as_owner();
  update public.profiles set provider_slug = sl2 where id = o2;
  perform pg_temp.as_owner();
  select count(*) into n from public.bookings where id in (b1, b2, b3);
  r := r || pg_temp.chk('9 category off: bookings preserved (' || n || ' of 3)', n = 3);
  perform pg_temp.as_user(a);
  perform public.admin_set_category_active(garden, true);
  perform pg_temp.as_owner();

  -- 10 verification requirements come from the categories
  perform pg_temp.as_user(o);
  js := public.review_blockers(sl)->'provider';
  r := r || pg_temp.chk('10 gardening needs no certificate by default', not (js::text like '%trade certificate%'));
  perform pg_temp.as_user(a);
  perform public.admin_save_category(garden, '{"name":"Gardening & Outdoor Care","requires_licence":true,"requirements":[{"key":"ref_letter","label":"Reference letter","kind":"reference","required":true}]}');
  perform pg_temp.as_user(o);
  js := public.review_blockers(sl)->'provider';
  r := r || pg_temp.chk('10 a category can require a licence', js::text like '%trade certificate%');
  r := r || pg_temp.chk('10 a category can require extra documents', js::text like '%Upload: Reference letter%');
  perform pg_temp.as_user(a);
  perform public.admin_save_category(garden, '{"name":"Gardening & Outdoor Care","requires_licence":false,"requirements":[]}');
  perform pg_temp.as_owner();

  -- childcare: switch it on inside the test to prove the enhanced requirements work
  perform pg_temp.as_user(a);
  s_kid := public.admin_save_category_service(null, kids, 'Evening babysitting', '', 180, 10);
  perform public.admin_set_category_active(kids, true);
  perform pg_temp.as_user(o2);
  perform public.set_my_categories(array['pet-care', 'babysitting-childcare']);
  js := public.review_blockers(sl2)->'provider';
  r := r || pg_temp.chk('10 childcare asks for references, screening and safeguarding documents',
    js::text like '%references from two families%' and js::text like '%Background screening%' and js::text like '%safeguarding%');
  perform pg_temp.as_user(o);
  e := pg_temp.fails($q$select public.set_my_categories(array['gardening-outdoor-care', 'pet-care', 'babysitting-childcare'])$q$);
  r := r || pg_temp.chk('10 an approved provider cannot add a category that needs extra checks: ' || left(coalesce(e,'accepted'),40), e like '%extra checks%');
  perform pg_temp.as_owner();

  -- 11 providers from before the catalogue keep free-text services and their licence rule
  update public.providers set category = 'plumbing' where slug = sl2;
  perform pg_temp.as_user(o2);
  e := pg_temp.fails(format('insert into public.provider_services (provider_slug, name, from_price) values (%L, ''Leak repair'', 450)', sl2));
  r := r || pg_temp.chk('11 a provider in an old category can still add a free-text service: ' || coalesce(left(e,40), 'ok'), e is null);
  js := public.review_blockers(sl2)->'provider';
  r := r || pg_temp.chk('11 plumbing still needs a trade certificate', js::text like '%trade certificate%');
  perform pg_temp.as_owner();
  select (c2.active and c2.is_legacy and not c2.open_to_new_providers)::text into e from public.service_categories c2 where slug = 'plumbing';
  r := r || pg_temp.chk('11 old categories stay active and visible but closed to new providers', e::boolean);

  raise exception '%', r;
end $$;
