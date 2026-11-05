-- Photo evidence for disputes. Private bucket, only the two people on the booking and admins can see it,
-- and nothing can be changed or deleted once uploaded, so the history is preserved.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dispute-evidence', 'dispute-evidence', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create table public.dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes (id) on delete cascade,
  uploaded_by uuid not null references auth.users (id) on delete cascade,
  path text not null unique,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  created_at timestamptz not null default now()
);

create index dispute_evidence_dispute_idx on public.dispute_evidence (dispute_id, created_at);

alter table public.dispute_evidence enable row level security;

-- Who is on a dispute: the customer who opened it, the provider on the booking, and admins.
create function public.is_dispute_party(p_dispute uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.disputes d
    join public.bookings b on b.id = d.booking_id
    where d.id = p_dispute
      and (
        b.user_id = (select auth.uid())
        or b.provider_slug = (select public.current_provider_slug())
        or (select public.is_admin())
      )
  )
$$;

revoke execute on function public.is_dispute_party(uuid) from public, anon;
grant execute on function public.is_dispute_party(uuid) to authenticated;

create policy "Parties and admins read evidence"
  on public.dispute_evidence for select to authenticated
  using (public.is_dispute_party(dispute_id));

grant select on public.dispute_evidence to authenticated;
-- No insert, update or delete grants: rows are added only through add_dispute_evidence below.

-- Files live at <dispute id>/<uploader id>/<file>. A person can only add files to a dispute they are on,
-- while it is open, into their own folder. Nobody can overwrite or remove a file.
create policy "Dispute parties upload evidence"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'dispute-evidence'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (
      select 1 from public.disputes d
      where d.id::text = (storage.foldername(name))[1]
        and d.status = 'open'
        and public.is_dispute_party(d.id)
    )
  );

create policy "Dispute parties read evidence files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'dispute-evidence'
    and exists (
      select 1 from public.disputes d
      where d.id::text = (storage.foldername(name))[1]
        and public.is_dispute_party(d.id)
    )
  );

create function public.add_dispute_evidence(p_dispute uuid, p_path text, p_type text, p_size integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  d public.disputes;
  n integer;
  new_id uuid;
begin
  select * into d from public.disputes where id = p_dispute;
  if not found or not public.is_dispute_party(p_dispute) then raise exception 'Dispute not found'; end if;
  if (select public.is_admin()) and not exists (
    select 1 from public.bookings b where b.id = d.booking_id and (b.user_id = uid or b.provider_slug = (select public.current_provider_slug()))
  ) then
    raise exception 'Admins review evidence but do not add it';
  end if;
  if d.status <> 'open' then raise exception 'This dispute has been decided'; end if;
  if p_path not like p_dispute::text || '/' || uid::text || '/%' then raise exception 'Invalid file path'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'dispute-evidence' and o.name = p_path) then
    raise exception 'The file was not uploaded';
  end if;
  select count(*) into n from public.dispute_evidence where dispute_id = p_dispute and uploaded_by = uid;
  if n >= 6 then raise exception 'You can add up to 6 photos'; end if;
  insert into public.dispute_evidence (dispute_id, uploaded_by, path, content_type, size_bytes)
  values (p_dispute, uid, p_path, p_type, p_size)
  returning dispute_evidence.id into new_id;
  insert into public.booking_events (booking_id, kind, detail)
  values (d.booking_id, 'dispute_reply', 'A photo was added as evidence');
  return new_id;
end;
$$;

revoke execute on function public.add_dispute_evidence(uuid, text, text, integer) from public, anon;
grant execute on function public.add_dispute_evidence(uuid, text, text, integer) to authenticated;
