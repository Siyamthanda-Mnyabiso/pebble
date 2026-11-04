-- Provider vetting: a status workflow, a mandatory admin checklist, documents,
-- an audit trail, and a rule that only approved providers are public.

create table public.provider_verification (
  provider_slug text primary key references public.providers (slug) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'changes_requested', 'approved', 'rejected', 'suspended')),
  note text not null default '' check (char_length(note) <= 1000),
  intro_video_url text not null default ''
    check (intro_video_url = '' or intro_video_url ~ '^https://[^\s]{4,300}$'),
  submitted_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  -- The admin checklist. Every one must be true before approval.
  intro_video_reviewed boolean not null default false,
  portfolio_reviewed boolean not null default false,
  contact_verified boolean not null default false,
  business_verified boolean not null default false,
  category_requirements_met boolean not null default false,
  documents_checked boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.provider_verification enable row level security;

create policy "Owners and admins read verification"
  on public.provider_verification for select to authenticated
  using (provider_slug = (select public.current_provider_slug()) or (select public.is_admin()));

-- Providers may only edit their intro video link, and only while it is theirs to edit.
create policy "Owners edit their intro video"
  on public.provider_verification for update to authenticated
  using (provider_slug = (select public.current_provider_slug()) and status in ('draft', 'changes_requested'))
  with check (provider_slug = (select public.current_provider_slug()) and status in ('draft', 'changes_requested'));

grant select on public.provider_verification to authenticated;
grant update (intro_video_url) on public.provider_verification to authenticated;

create table public.provider_review_events (
  id uuid primary key default gen_random_uuid(),
  provider_slug text not null references public.providers (slug) on delete cascade,
  kind text not null check (kind in ('submitted', 'resubmitted', 'changes_requested', 'approved', 'rejected', 'suspended', 'reinstated')),
  note text not null default '',
  actor uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index provider_review_events_idx on public.provider_review_events (provider_slug, created_at);
alter table public.provider_review_events enable row level security;
create policy "Owners and admins read review events"
  on public.provider_review_events for select to authenticated
  using (provider_slug = (select public.current_provider_slug()) or (select public.is_admin()));
grant select on public.provider_review_events to authenticated;

create table public.provider_documents (
  id uuid primary key default gen_random_uuid(),
  provider_slug text not null references public.providers (slug) on delete cascade,
  kind text not null check (kind in ('id', 'business', 'certification')),
  label text not null check (char_length(label) between 1 and 120),
  path text not null check (path like provider_slug || '/%'),
  created_at timestamptz not null default now()
);
create index provider_documents_idx on public.provider_documents (provider_slug);
alter table public.provider_documents enable row level security;
create policy "Owners and admins read documents"
  on public.provider_documents for select to authenticated
  using (provider_slug = (select public.current_provider_slug()) or (select public.is_admin()));
create policy "Owners add documents"
  on public.provider_documents for insert to authenticated
  with check (provider_slug = (select public.current_provider_slug()));
create policy "Owners remove documents"
  on public.provider_documents for delete to authenticated
  using (provider_slug = (select public.current_provider_slug()));
grant select, delete on public.provider_documents to authenticated;
grant insert (provider_slug, kind, label, path) on public.provider_documents to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('provider-docs', 'provider-docs', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

create policy "Owners upload their documents" on storage.objects for insert to authenticated
  with check (bucket_id = 'provider-docs' and (storage.foldername(name))[1] = (select public.current_provider_slug()));
create policy "Owners and admins read documents" on storage.objects for select to authenticated
  using (bucket_id = 'provider-docs'
    and ((storage.foldername(name))[1] = (select public.current_provider_slug()) or (select public.is_admin())));
create policy "Owners delete their documents" on storage.objects for delete to authenticated
  using (bucket_id = 'provider-docs' and (storage.foldername(name))[1] = (select public.current_provider_slug()));

-- Only approved providers are public. This keeps providers.active and verified in step.
create function public.sync_provider_visibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.providers
     set active = (new.status = 'approved'), verified = (new.status = 'approved')
   where slug = new.provider_slug;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.sync_provider_visibility() from public, anon, authenticated;

create trigger provider_verification_visibility
  after insert or update of status on public.provider_verification
  for each row execute function public.sync_provider_visibility();

-- Every new listing starts as a draft.
create function public.start_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.provider_verification (provider_slug) values (new.slug) on conflict do nothing;
  return new;
end;
$$;
revoke execute on function public.start_verification() from public, anon, authenticated;
create trigger providers_start_verification
  after insert on public.providers
  for each row execute function public.start_verification();

-- Existing providers: verified ones stay public, the rest go back to draft.
insert into public.provider_verification (provider_slug, status, approved_at)
select slug, case when verified then 'approved' else 'draft' end, case when verified then now() end
from public.providers
on conflict do nothing;

-- Owners must see their own listing even while it is not public.
create policy "Owners read their listing"
  on public.providers for select to authenticated
  using (slug = (select public.current_provider_slug()));

-- What still blocks a provider, split into what they must supply and what an admin must tick.
create function public.review_blockers(p_slug text)
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
  if not ((select public.is_admin()) or p_slug = (select public.current_provider_slug())) then
    raise exception 'Not allowed';
  end if;
  select * into v from public.provider_verification where provider_slug = p_slug;
  select * into p from public.providers where slug = p_slug;
  if v.provider_slug is null then raise exception 'Provider not found'; end if;
  select pr.phone into phone from public.profiles pr where pr.provider_slug = p_slug;
  select count(distinct u) into photos from unnest(p.gallery || p.work) u where u !~ '^/images/';

  if char_length(btrim(p.about)) < 40 then prov := prov || 'Write a business description of at least 40 characters'; end if;
  if v.intro_video_url = '' then prov := prov || 'Add a link to your intro video'; end if;
  if photos < 3 then prov := prov || 'Upload at least 3 portfolio photos'; end if;
  if not exists (select 1 from public.provider_services where provider_slug = p_slug) then
    prov := prov || 'Add at least one service with a price';
  end if;
  if coalesce(phone, '') = '' then prov := prov || 'Add a phone number in your account settings'; end if;
  if not exists (select 1 from public.provider_documents where provider_slug = p_slug and kind = 'id') then
    prov := prov || 'Upload a copy of your ID';
  end if;
  if p.category in ('plumbing', 'electrical') and not exists (
    select 1 from public.provider_documents where provider_slug = p_slug and kind = 'certification') then
    prov := prov || 'Upload your trade certificate or registration';
  end if;

  if not v.intro_video_reviewed then adm := adm || 'Intro video reviewed'; end if;
  if not v.portfolio_reviewed then adm := adm || 'Portfolio reviewed'; end if;
  if not v.contact_verified then adm := adm || 'Contact details verified'; end if;
  if not v.business_verified then adm := adm || 'Business info verified'; end if;
  if not v.category_requirements_met then adm := adm || 'Category requirements met'; end if;
  if not v.documents_checked then adm := adm || 'Documents checked'; end if;

  return jsonb_build_object('provider', to_jsonb(prov), 'admin', to_jsonb(adm));
end;
$$;

-- Tell every admin something needs them.
create function public.notify_admins(p_title text, p_body text, p_href text)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.notify(id, 'verification', p_title, p_body, p_href) from public.profiles where is_admin
$$;
revoke execute on function public.notify_admins(text, text, text) from public, anon, authenticated;

-- Internal: log an event and tell the provider.
create function public.record_review(p_slug text, p_kind text, p_note text, p_title text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare owner uuid; mail text; biz text;
begin
  insert into public.provider_review_events (provider_slug, kind, note, actor)
  values (p_slug, p_kind, coalesce(p_note, ''), (select auth.uid()));
  select name into biz from public.providers where slug = p_slug;
  select id into owner from public.profiles where provider_slug = p_slug;
  if owner is not null then
    perform public.notify(owner, 'verification', p_title, left(coalesce(nullif(p_note, ''), biz), 200), '/dashboard/verification');
    select email into mail from auth.users where id = owner;
  end if;
  return jsonb_build_object('email', mail, 'name', biz);
end;
$$;
revoke execute on function public.record_review(text, text, text, text) from public, anon, authenticated;

create function public.submit_for_review()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text := (select public.current_provider_slug());
  v public.provider_verification;
  b jsonb;
  biz text;
begin
  if v_slug is null then raise exception 'Create your listing first'; end if;
  select * into v from public.provider_verification where provider_slug = v_slug;
  if v.status not in ('draft', 'changes_requested') then
    raise exception 'This listing cannot be submitted right now';
  end if;
  b := public.review_blockers(v_slug);
  if jsonb_array_length(b -> 'provider') > 0 then
    raise exception 'Not ready: %', (select string_agg(x, '; ') from jsonb_array_elements_text(b -> 'provider') x);
  end if;

  update public.provider_verification
     set status = 'pending_review', submitted_at = now(), note = '',
         intro_video_reviewed = false, portfolio_reviewed = false, contact_verified = false,
         business_verified = false, category_requirements_met = false, documents_checked = false
   where provider_slug = v_slug;
  insert into public.provider_review_events (provider_slug, kind, actor)
  values (v_slug, case when v.status = 'changes_requested' then 'resubmitted' else 'submitted' end, (select auth.uid()));
  select name into biz from public.providers where providers.slug = v_slug;
  perform public.notify_admins('Provider awaiting review', coalesce(biz, v_slug), '/admin/providers/' || v_slug);
  return jsonb_build_object('name', biz);
end;
$$;

create function public.admin_set_vetting(p_slug text, p_field text, p_value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  if not exists (select 1 from public.provider_verification where provider_slug = p_slug and status = 'pending_review') then
    raise exception 'Only providers under review can be checked';
  end if;
  update public.provider_verification set
    intro_video_reviewed = case when p_field = 'intro_video_reviewed' then p_value else intro_video_reviewed end,
    portfolio_reviewed = case when p_field = 'portfolio_reviewed' then p_value else portfolio_reviewed end,
    contact_verified = case when p_field = 'contact_verified' then p_value else contact_verified end,
    business_verified = case when p_field = 'business_verified' then p_value else business_verified end,
    category_requirements_met = case when p_field = 'category_requirements_met' then p_value else category_requirements_met end,
    documents_checked = case when p_field = 'documents_checked' then p_value else documents_checked end
  where provider_slug = p_slug;
  if p_field not in ('intro_video_reviewed', 'portfolio_reviewed', 'contact_verified',
      'business_verified', 'category_requirements_met', 'documents_checked') then
    raise exception 'Unknown checklist item';
  end if;
end;
$$;

create function public.admin_approve_provider(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare b jsonb; missing text;
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  if not exists (select 1 from public.provider_verification where provider_slug = p_slug and status = 'pending_review') then
    raise exception 'Only providers under review can be approved';
  end if;
  b := public.review_blockers(p_slug);
  select string_agg(x, '; ') into missing from (
    select jsonb_array_elements_text(b -> 'provider') x union all select jsonb_array_elements_text(b -> 'admin')) s;
  if missing is not null then raise exception 'Cannot approve yet: %', missing; end if;

  update public.provider_verification
     set status = 'approved', approved_by = (select auth.uid()), approved_at = now(), note = ''
   where provider_slug = p_slug;
  return public.record_review(p_slug, 'approved', '', 'Your listing is approved and live');
end;
$$;

create function public.admin_request_changes(p_slug text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  if char_length(btrim(coalesce(p_note, ''))) < 5 then raise exception 'Tell the provider what is missing'; end if;
  update public.provider_verification set status = 'changes_requested', note = left(btrim(p_note), 1000)
   where provider_slug = p_slug and status = 'pending_review';
  if not found then raise exception 'Only providers under review can be sent back'; end if;
  return public.record_review(p_slug, 'changes_requested', btrim(p_note), 'Changes needed on your listing');
end;
$$;

create function public.admin_reject_provider(p_slug text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  if char_length(btrim(coalesce(p_note, ''))) < 5 then raise exception 'Give the provider a reason'; end if;
  update public.provider_verification set status = 'rejected', note = left(btrim(p_note), 1000)
   where provider_slug = p_slug and status = 'pending_review';
  if not found then raise exception 'Only providers under review can be rejected'; end if;
  return public.record_review(p_slug, 'rejected', btrim(p_note), 'Your listing was not approved');
end;
$$;

create function public.admin_suspend_provider(p_slug text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  if char_length(btrim(coalesce(p_note, ''))) < 5 then raise exception 'Give the provider a reason'; end if;
  update public.provider_verification set status = 'suspended', note = left(btrim(p_note), 1000)
   where provider_slug = p_slug and status = 'approved';
  if not found then raise exception 'Only approved providers can be suspended'; end if;
  return public.record_review(p_slug, 'suspended', btrim(p_note), 'Your listing was suspended');
end;
$$;

create function public.admin_reinstate_provider(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  update public.provider_verification set status = 'approved', note = ''
   where provider_slug = p_slug and status = 'suspended';
  if not found then raise exception 'Only suspended providers can be reinstated'; end if;
  return public.record_review(p_slug, 'reinstated', '', 'Your listing is live again');
end;
$$;

-- The old one-click approval is gone: approval only happens through the checklist.
drop function public.admin_set_provider(text, boolean, boolean);

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


revoke execute on function public.review_blockers(text) from public, anon;
revoke execute on function public.submit_for_review() from public, anon;
revoke execute on function public.admin_set_vetting(text, text, boolean) from public, anon;
revoke execute on function public.admin_approve_provider(text) from public, anon;
revoke execute on function public.admin_request_changes(text, text) from public, anon;
revoke execute on function public.admin_reject_provider(text, text) from public, anon;
revoke execute on function public.admin_suspend_provider(text, text) from public, anon;
revoke execute on function public.admin_reinstate_provider(text) from public, anon;
grant execute on function public.review_blockers(text) to authenticated;
grant execute on function public.submit_for_review() to authenticated;
grant execute on function public.admin_set_vetting(text, text, boolean) to authenticated;
grant execute on function public.admin_approve_provider(text) to authenticated;
grant execute on function public.admin_request_changes(text, text) to authenticated;
grant execute on function public.admin_reject_provider(text, text) to authenticated;
grant execute on function public.admin_suspend_provider(text, text) to authenticated;
grant execute on function public.admin_reinstate_provider(text) to authenticated;
