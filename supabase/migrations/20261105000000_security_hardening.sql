-- Security hardening from the persona QA pass (customer, provider, admin and attacker).
-- Every rule below already existed in the app code. This moves it into the database, so
-- it also holds for anyone who talks to Supabase directly instead of using the app.

-- 1. Bookings: the database decides price, fee, provider, service, date and time ------------

create function public.enforce_booking_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sa_now timestamp := now() at time zone 'Africa/Johannesburg';
  owner uuid;
  is_active boolean;
  unit_price integer;
  open_times text[];
begin
  select p.active into is_active from public.providers p where p.slug = new.provider_slug;
  if is_active is not true then raise exception 'That provider is not available for booking'; end if;

  select id into owner from public.profiles where provider_slug = new.provider_slug;
  if owner is not distinct from new.user_id then
    raise exception 'You cannot book your own listing';
  end if;

  select s.from_price into unit_price from public.provider_services s
    where s.provider_slug = new.provider_slug and s.name = new.service;
  if unit_price is null then raise exception 'That service is not offered'; end if;

  if new.scheduled_date < sa_now::date
     or (new.scheduled_date = sa_now::date and extract(hour from new.start_time) <= extract(hour from sa_now)) then
    raise exception 'Choose a time in the future';
  end if;

  select times into open_times from public.provider_hours
    where provider_slug = new.provider_slug and weekday = extract(dow from new.scheduled_date)::int;
  if open_times is null or not (to_char(new.start_time, 'HH24:MI') = any (open_times))
     or exists (select 1 from public.provider_time_off
                where provider_slug = new.provider_slug and day = new.scheduled_date) then
    raise exception 'The provider is not available then';
  end if;

  if (select count(*) from public.bookings
        where user_id = new.user_id and status = 'pending') >= 10 then
    raise exception 'You have too many pending bookings. Wait for some to be confirmed.';
  end if;

  -- Money is never taken from the client.
  new.price_cents := unit_price * 100;
  new.fee_cents := 2500;
  return new;
end;
$$;

revoke execute on function public.enforce_booking_rules() from public, anon, authenticated;

create trigger bookings_enforce_rules
  before insert on public.bookings
  for each row execute function public.enforce_booking_rules();

alter table public.bookings
  add constraint bookings_reference_len check (char_length(reference) <= 20) not valid;

-- A provider whose listing is not live cannot confirm or complete jobs.
create function public.block_inactive_provider_jobs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('confirmed', 'completed')
     and exists (select 1 from public.profiles
                 where id = (select auth.uid()) and provider_slug = old.provider_slug)
     and not exists (select 1 from public.providers where slug = old.provider_slug and active) then
    raise exception 'Your listing is not live right now';
  end if;
  return new;
end;
$$;

revoke execute on function public.block_inactive_provider_jobs() from public, anon, authenticated;

create trigger bookings_block_inactive_provider
  before update on public.bookings
  for each row execute function public.block_inactive_provider_jobs();

-- Payouts only for approved listings.
create or replace function public.request_payout()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  slug text := public.current_provider_slug();
  amount integer := public.payout_balance();
begin
  if slug is null then raise exception 'No listing'; end if;
  if not exists (select 1 from public.provider_verification where provider_slug = slug and status = 'approved') then
    raise exception 'Your listing must be approved to request a payout';
  end if;
  if amount < 10000 then raise exception 'The minimum payout is R100'; end if;
  insert into public.payouts (provider_slug, amount_cents) values (slug, amount);
  return amount;
end;
$$;

-- 2. Reviews: always about the booked provider, never pre-hidden, rating follows hiding --------

create function public.force_review_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare booked text;
begin
  select provider_slug into booked from public.bookings where id = new.booking_id;
  if booked is null then raise exception 'Booking not found'; end if;
  new.provider_slug := booked;
  new.hidden := false;
  return new;
end;
$$;

revoke execute on function public.force_review_fields() from public, anon, authenticated;

create trigger reviews_force_fields
  before insert on public.reviews
  for each row execute function public.force_review_fields();

create or replace function public.admin_set_review_hidden(p_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare r public.reviews;
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  select * into r from public.reviews where id = p_id;
  if not found then raise exception 'Review not found'; end if;
  if r.hidden = p_hidden then return; end if;
  update public.reviews set hidden = p_hidden where id = p_id;
  -- Keep the provider's rating in step: a hidden review does not count.
  if p_hidden then
    update public.providers
       set rating_total = greatest(rating_total - r.rating, 0),
           review_count = greatest(review_count - 1, 0),
           rating = case when review_count - 1 > 0
                         then round(greatest(rating_total - r.rating, 0)::numeric / (review_count - 1), 1)
                         else 0 end
     where slug = r.provider_slug;
  else
    update public.providers
       set rating_total = rating_total + r.rating,
           review_count = review_count + 1,
           rating = round((rating_total + r.rating)::numeric / (review_count + 1), 1)
     where slug = r.provider_slug;
  end if;
end;
$$;

-- 3. Vetting: no self-approval, real checks, no leak of blockers ----------------------------

create function public.block_self_vetting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.profiles
             where id = (select auth.uid()) and provider_slug = new.provider_slug)
     and (
       (new.status = 'approved' and old.status is distinct from 'approved')
       or (new.intro_video_reviewed and not old.intro_video_reviewed)
       or (new.portfolio_reviewed and not old.portfolio_reviewed)
       or (new.contact_verified and not old.contact_verified)
       or (new.business_verified and not old.business_verified)
       or (new.category_requirements_met and not old.category_requirements_met)
       or (new.documents_checked and not old.documents_checked)
       or new.approved_video_path is distinct from old.approved_video_path
     ) then
    raise exception 'You cannot review your own listing. Ask another admin.';
  end if;
  return new;
end;
$$;

revoke execute on function public.block_self_vetting() from public, anon, authenticated;

create trigger provider_verification_block_self
  before update on public.provider_verification
  for each row execute function public.block_self_vetting();

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
  if p.category in ('plumbing', 'electrical') and not exists (
    select 1 from public.provider_documents d
    join storage.objects o on o.bucket_id = 'provider-docs' and o.name = d.path
    where d.provider_slug = p_slug and d.kind = 'certification' and d.path not like '%..%') then
    prov := array_append(prov, 'Upload your trade certificate or registration'::text);
  end if;

  if not v.intro_video_reviewed then adm := array_append(adm, 'Intro video reviewed'::text); end if;
  if not v.portfolio_reviewed then adm := array_append(adm, 'Portfolio reviewed'::text); end if;
  if not v.contact_verified then adm := array_append(adm, 'Contact details verified'::text); end if;
  if not v.business_verified then adm := array_append(adm, 'Business info verified'::text); end if;
  if not v.category_requirements_met then adm := array_append(adm, 'Category requirements met'::text); end if;
  if not v.documents_checked then adm := array_append(adm, 'Documents checked'::text); end if;

  return jsonb_build_object('provider', to_jsonb(prov), 'admin', to_jsonb(adm));
end;
$$;

-- A listing is frozen while an admin is reviewing it, and its category is locked once submitted,
-- so it cannot be swapped after the checks are done.
create function public.lock_listing_after_submit()
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
       or new.gallery is distinct from old.gallery or new.work is distinct from old.work) then
    raise exception 'Your listing is under review. You can edit it again once the review is done.';
  end if;
  if st = 'approved' and new.category is distinct from old.category then
    raise exception 'To change your category, contact support so your listing can be re-checked.';
  end if;
  return new;
end;
$$;

revoke execute on function public.lock_listing_after_submit() from public, anon, authenticated;

create trigger providers_lock_after_submit
  before update on public.providers
  for each row execute function public.lock_listing_after_submit();

create function public.lock_documents_after_submit()
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
    if st in ('pending_review', 'approved') and old.kind in ('id', 'certification') then
      raise exception 'Documents cannot be removed while your listing is under review or live.';
    end if;
  end if;
  return old;
end;
$$;

revoke execute on function public.lock_documents_after_submit() from public, anon, authenticated;

create trigger provider_documents_lock_after_submit
  before delete on public.provider_documents
  for each row execute function public.lock_documents_after_submit();

-- 4. Hidden providers stay hidden: services, hours, time off, reviews, booked times --------

drop policy "Anyone can read services" on public.provider_services;
create policy "Public reads services of live providers"
  on public.provider_services for select to anon
  using (exists (select 1 from public.providers p where p.slug = provider_slug and p.active));
create policy "Signed in reads services"
  on public.provider_services for select to authenticated
  using (
    exists (select 1 from public.providers p where p.slug = provider_slug and p.active)
    or provider_slug = (select public.current_provider_slug())
    or (select public.is_admin())
  );

drop policy "Anyone can read hours" on public.provider_hours;
create policy "Public reads hours of live providers"
  on public.provider_hours for select to anon
  using (exists (select 1 from public.providers p where p.slug = provider_slug and p.active));
create policy "Signed in reads hours"
  on public.provider_hours for select to authenticated
  using (
    exists (select 1 from public.providers p where p.slug = provider_slug and p.active)
    or provider_slug = (select public.current_provider_slug())
    or (select public.is_admin())
  );

drop policy "Anyone can read time off" on public.provider_time_off;
create policy "Public reads time off of live providers"
  on public.provider_time_off for select to anon
  using (exists (select 1 from public.providers p where p.slug = provider_slug and p.active));
create policy "Signed in reads time off"
  on public.provider_time_off for select to authenticated
  using (
    exists (select 1 from public.providers p where p.slug = provider_slug and p.active)
    or provider_slug = (select public.current_provider_slug())
    or (select public.is_admin())
  );

create or replace function public.booked_times(p_slug text, p_from date, p_to date)
returns table (day date, t text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.scheduled_date, to_char(b.start_time, 'HH24:MI')
  from public.bookings b
  where b.provider_slug = p_slug
    and b.scheduled_date between p_from and p_to
    and b.status in ('pending', 'confirmed')
    and exists (select 1 from public.providers p where p.slug = p_slug and p.active)
$$;

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
    and exists (select 1 from public.providers pr where pr.slug = p_slug and pr.active)
  order by r.created_at desc
  limit 20
$$;

-- 5. Approved intro videos must play for visitors who are not signed in -------------------

drop policy "Videos are readable by owner, admin or when approved" on storage.objects;
create policy "Public reads approved videos"
  on storage.objects for select to anon
  using (bucket_id = 'provider-videos' and public.is_public_video(name));
create policy "Signed in reads own, approved or admin videos"
  on storage.objects for select to authenticated
  using (bucket_id = 'provider-videos' and (
    (storage.foldername(name))[1] = (select public.current_provider_slug())
    or (select public.is_admin())
    or public.is_public_video(name)));

-- 6. Chat: only the two people on the booking can write ------------------------------------

drop policy "Booking parties send messages" on public.messages;
create policy "Booking parties send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (b.user_id = (select auth.uid())
             or b.provider_slug = (select public.current_provider_slug()))
    )
    and (image_path is null or image_path like booking_id::text || '/%')
  );

-- 7. Sizes and shapes: new rows only, so nothing existing is rejected -----------------------

alter table public.profiles
  add constraint profiles_full_name_len check (char_length(full_name) <= 80) not valid,
  add constraint profiles_phone_len check (char_length(phone) <= 30) not valid,
  add constraint profiles_address_len check (char_length(address) <= 200) not valid;

alter table public.saved_providers
  add constraint saved_providers_provider_fk
  foreign key (provider_slug) references public.providers (slug) on delete cascade not valid;

alter table public.provider_verification
  add constraint provider_verification_video_path_safe
  check (video_path not like '%..%' and char_length(video_path) <= 200) not valid;

alter table public.provider_documents
  add constraint provider_documents_path_safe
  check (path not like '%..%' and char_length(path) <= 200) not valid;

alter table public.messages
  add constraint messages_image_path_safe
  check (image_path is null or (image_path not like '%..%' and char_length(image_path) <= 200)) not valid;

alter table public.providers
  add constraint providers_city_len check (char_length(btrim(city)) >= 2) not valid;

alter table public.contact_messages
  add constraint contact_messages_email_shape check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') not valid;
