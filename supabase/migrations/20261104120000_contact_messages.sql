-- Messages sent from the public contact form. Write-only for visitors;
-- they are read by the team in the Supabase dashboard.
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 200),
  topic text not null default 'General' check (char_length(topic) <= 50),
  message text not null check (char_length(message) between 5 and 2000),
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

create policy "Anyone can send a contact message"
  on public.contact_messages for insert to anon, authenticated
  with check (true);
