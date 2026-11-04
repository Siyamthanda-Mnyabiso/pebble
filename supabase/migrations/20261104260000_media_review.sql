-- Intro video upload, a public video only after approval, and audited, short-lived
-- access to private verification documents.

alter table public.provider_verification
  add column video_path text not null default ''
    check (video_path = '' or video_path like provider_slug || '/%'),
  add column approved_video_path text not null default ''
    check (approved_video_path = '' or approved_video_path like provider_slug || '/%');

-- A provider may now also replace their video while approved. The old video stays
-- public until an admin approves the replacement.
drop policy "Owners edit their intro video" on public.provider_verification;
create policy "Owners edit their intro video"
  on public.provider_verification for update to authenticated
  using (provider_slug = (select public.current_provider_slug()) and status in ('draft', 'changes_requested', 'approved'))
  with check (provider_slug = (select public.current_provider_slug()) and status in ('draft', 'changes_requested', 'approved'));
revoke update (intro_video_url) on public.provider_verification from authenticated;
grant update (video_path) on public.provider_verification to authenticated;

alter table public.provider_review_events drop constraint provider_review_events_kind_check;
alter table public.provider_review_events add constraint provider_review_events_kind_check
  check (kind in ('submitted', 'resubmitted', 'changes_requested', 'approved', 'rejected', 'suspended',
                  'reinstated', 'video_replaced', 'video_approved', 'video_rejected'));

-- A replacement on an approved listing goes back in the queue.
create function public.on_video_replaced()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.video_path is distinct from old.video_path and new.video_path <> '' and new.status = 'approved' then
    insert into public.provider_review_events (provider_slug, kind, actor)
    values (new.provider_slug, 'video_replaced', (select auth.uid()));
    perform public.notify_admins('New intro video to review',
      (select name from public.providers where slug = new.provider_slug), '/admin/providers/' || new.provider_slug);
  end if;
  return new;
end;
$$;
revoke execute on function public.on_video_replaced() from public, anon, authenticated;
create trigger provider_verification_video
  after update of video_path on public.provider_verification
  for each row execute function public.on_video_replaced();

-- Videos live in a private bucket. Only the owner, admins, and anyone watching an
-- approved, public provider's approved video can read a file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('provider-videos', 'provider-videos', false, 52428800,
  array['video/mp4', 'video/quicktime', 'video/webm']);

create function public.is_public_video(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.provider_verification v
    join public.providers p on p.slug = v.provider_slug
    where v.approved_video_path = p_name and p.active
  )
$$;
grant execute on function public.is_public_video(text) to anon, authenticated;

create policy "Owners upload videos" on storage.objects for insert to authenticated
  with check (bucket_id = 'provider-videos' and (storage.foldername(name))[1] = (select public.current_provider_slug()));
create policy "Videos are readable by owner, admin or when approved" on storage.objects for select to anon, authenticated
  using (bucket_id = 'provider-videos' and (
    (storage.foldername(name))[1] = (select public.current_provider_slug())
    or (select public.is_admin())
    or public.is_public_video(name)));

-- The approved video's path, for the public profile.
create function public.public_intro_video(p_slug text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(v.approved_video_path, '') from public.provider_verification v
  join public.providers p on p.slug = v.provider_slug
  where v.provider_slug = p_slug and p.active
$$;
grant execute on function public.public_intro_video(text) to anon, authenticated;

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
  if not ((select public.is_admin()) or p_slug = (select public.current_provider_slug())) then
    raise exception 'Not allowed';
  end if;
  select * into v from public.provider_verification where provider_slug = p_slug;
  select * into p from public.providers where slug = p_slug;
  if v.provider_slug is null then raise exception 'Provider not found'; end if;
  select pr.phone into phone from public.profiles pr where pr.provider_slug = p_slug;
  select count(distinct u) into photos from unnest(p.gallery || p.work) u where u !~ '^/images/';

  if char_length(btrim(p.about)) < 40 then prov := array_append(prov, 'Write a business description of at least 40 characters'::text); end if;
  if v.video_path = '' then prov := array_append(prov, 'Upload your intro video'::text); end if;
  if photos < 3 then prov := array_append(prov, 'Upload at least 3 portfolio photos'::text); end if;
  if not exists (select 1 from public.provider_services where provider_slug = p_slug) then
    prov := array_append(prov, 'Add at least one service with a price'::text);
  end if;
  if coalesce(phone, '') = '' then prov := array_append(prov, 'Add a phone number in your account settings'::text); end if;
  if not exists (select 1 from public.provider_documents where provider_slug = p_slug and kind = 'id') then
    prov := array_append(prov, 'Upload a copy of your ID'::text);
  end if;
  if p.category in ('plumbing', 'electrical') and not exists (
    select 1 from public.provider_documents where provider_slug = p_slug and kind = 'certification') then
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


create or replace function public.admin_approve_provider(p_slug text)
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
     set status = 'approved', approved_by = (select auth.uid()), approved_at = now(), note = '',
         approved_video_path = video_path
   where provider_slug = p_slug;
  return public.record_review(p_slug, 'approved', '', 'Your listing is approved and live');
end;
$$;


create function public.admin_approve_video(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  update public.provider_verification set approved_video_path = video_path
   where provider_slug = p_slug and status = 'approved' and video_path <> '' and video_path <> approved_video_path;
  if not found then raise exception 'Only a replaced video on an approved provider can be approved'; end if;
  return public.record_review(p_slug, 'video_approved', '', 'Your new intro video is live');
end;
$$;

create function public.admin_reject_video(p_slug text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  if char_length(btrim(coalesce(p_note, ''))) < 5 then raise exception 'Tell the provider why the video was not accepted'; end if;
  update public.provider_verification set video_path = approved_video_path
   where provider_slug = p_slug and status = 'approved' and video_path <> approved_video_path;
  if not found then raise exception 'Only a replaced video on an approved provider can be rejected'; end if;
  return public.record_review(p_slug, 'video_rejected', btrim(p_note), 'Your new intro video was not accepted');
end;
$$;

-- Documents: every preview is a logged, ten minute grant to one admin.
create table public.document_access_log (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.provider_documents (id) on delete set null,
  provider_slug text not null,
  document_label text not null,
  admin_id uuid not null references auth.users (id) on delete cascade,
  accessed_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index document_access_log_idx on public.document_access_log (provider_slug, accessed_at desc);
alter table public.document_access_log enable row level security;
create policy "Admins read the access log" on public.document_access_log for select to authenticated
  using ((select public.is_admin()));
grant select on public.document_access_log to authenticated;

create function public.admin_open_document(p_doc uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare d public.provider_documents; token uuid;
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  select * into d from public.provider_documents where id = p_doc;
  if d.id is null then raise exception 'Document not found'; end if;
  insert into public.document_access_log (document_id, provider_slug, document_label, admin_id, expires_at)
  values (d.id, d.provider_slug, d.label, (select auth.uid()), now() + interval '10 minutes')
  returning id into token;
  return token;
end;
$$;

-- Turns a live grant into the file's location, for the admin it was issued to.
create function public.admin_resolve_document(p_access uuid)
returns table (path text, label text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  return query
    select d.path, d.label from public.document_access_log l
    join public.provider_documents d on d.id = l.document_id
    where l.id = p_access and l.admin_id = (select auth.uid()) and l.expires_at > now();
end;
$$;

revoke execute on function public.admin_approve_video(text) from public, anon;
revoke execute on function public.admin_reject_video(text, text) from public, anon;
revoke execute on function public.admin_open_document(uuid) from public, anon;
revoke execute on function public.admin_resolve_document(uuid) from public, anon;
grant execute on function public.admin_approve_video(text) to authenticated;
grant execute on function public.admin_reject_video(text, text) to authenticated;
grant execute on function public.admin_open_document(uuid) to authenticated;
grant execute on function public.admin_resolve_document(uuid) to authenticated;
