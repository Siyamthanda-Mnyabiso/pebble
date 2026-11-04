-- Chat between a customer and the provider on a booking. One thread per booking.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_thread_idx on public.messages (booking_id, created_at);

alter table public.messages enable row level security;

-- Booking RLS decides who the two parties are: the customer and the provider's owner.
create policy "Booking parties read messages"
  on public.messages for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id));

create policy "Booking parties send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (select 1 from public.bookings b where b.id = booking_id)
  );

grant select on public.messages to authenticated;
grant insert (booking_id, body) on public.messages to authenticated;

-- Marks the other side's messages in a thread as read.
create function public.mark_thread_read(p_booking uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.messages m
     set read_at = now()
   where m.booking_id = p_booking
     and m.sender_id <> (select auth.uid())
     and m.read_at is null
     and exists (select 1 from public.bookings b where b.id = p_booking
                 and (b.user_id = (select auth.uid())
                      or b.provider_slug = (select public.current_provider_slug())))
$$;

revoke execute on function public.mark_thread_read(uuid) from public, anon;
grant execute on function public.mark_thread_read(uuid) to authenticated;

-- Tell the other side about a new message, but only once until they have read it.
create function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.bookings;
  owner uuid;
  recipient uuid;
  href text;
  who text;
begin
  select * into b from public.bookings where id = new.booking_id;
  select id into owner from public.profiles where provider_slug = b.provider_slug;

  if new.sender_id = b.user_id then
    recipient := owner;
    href := '/dashboard/messages/' || b.id;
    select coalesce(nullif(full_name, ''), 'A customer') into who from public.profiles where id = b.user_id;
  else
    recipient := b.user_id;
    href := '/account/messages/' || b.id;
    select name into who from public.providers where slug = b.provider_slug;
  end if;

  if recipient is null then return new; end if;

  if not exists (
    select 1 from public.notifications n
    where n.user_id = recipient and n.kind = 'message' and n.href = href and n.read_at is null
  ) then
    perform public.notify(recipient, 'message', 'New message from ' || coalesce(who, 'your booking'),
      left(new.body, 120), href);
  end if;
  return new;
end;
$$;

revoke execute on function public.notify_on_message() from public, anon, authenticated;

create trigger messages_notify
  after insert on public.messages
  for each row execute function public.notify_on_message();

alter publication supabase_realtime add table public.messages;
