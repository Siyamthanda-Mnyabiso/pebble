-- Photos in chat. Stored in a private bucket, one folder per booking, so only the
-- two people on the booking can see them.

alter table public.messages add column image_path text;

alter table public.messages drop constraint messages_body_check;
alter table public.messages add constraint messages_content_check check (
  char_length(btrim(body)) <= 1000
  and (char_length(btrim(body)) >= 1 or image_path is not null)
);

grant insert (image_path) on public.messages to authenticated;

drop policy "Booking parties send messages" on public.messages;
create policy "Booking parties send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (select 1 from public.bookings b where b.id = booking_id)
    and (image_path is null or image_path like booking_id::text || '/%')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "Booking parties upload chat images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and exists (
      select 1 from public.bookings b where b.id::text = (storage.foldername(name))[1]
    )
  );

create policy "Booking parties read chat images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-images'
    and exists (
      select 1 from public.bookings b where b.id::text = (storage.foldername(name))[1]
    )
  );

-- Notification text for a photo-only message.
create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.bookings;
  owner uuid;
  recipient uuid;
  thread_href text;
  who text;
begin
  select * into b from public.bookings where id = new.booking_id;
  select id into owner from public.profiles where provider_slug = b.provider_slug;

  if new.sender_id = b.user_id then
    recipient := owner;
    thread_href := '/dashboard/messages/' || b.id;
    select coalesce(nullif(full_name, ''), 'A customer') into who from public.profiles where id = b.user_id;
  else
    recipient := b.user_id;
    thread_href := '/account/messages/' || b.id;
    select name into who from public.providers where slug = b.provider_slug;
  end if;

  if recipient is null then return new; end if;

  if not exists (
    select 1 from public.notifications n
    where n.user_id = recipient and n.kind = 'message' and n.href = thread_href and n.read_at is null
  ) then
    perform public.notify(recipient, 'message', 'New message from ' || coalesce(who, 'your booking'),
      case when btrim(new.body) = '' then 'Sent a photo' else left(new.body, 120) end, thread_href);
  end if;
  return new;
end;
$$;
