-- Removing or replacing a file needs permission to see it first. The bucket is
-- public for viewing, so this only matters for the owner's own upload calls.
create policy "Providers see their own photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'provider-photos'
    and (storage.foldername(name))[1] = (select public.current_provider_slug())
  );
