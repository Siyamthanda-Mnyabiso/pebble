-- Admins also see suspended providers.
create policy "Admins read all providers"
  on public.providers for select to authenticated
  using ((select public.is_admin()));
