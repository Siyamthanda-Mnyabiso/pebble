-- Fix an ambiguous variable name in the message notification trigger.

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
      left(new.body, 120), thread_href);
  end if;
  return new;
end;
$$;

