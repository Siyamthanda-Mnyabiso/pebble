-- Provider photo uploads: a public bucket where each provider can only write
-- inside their own folder (named after their listing slug).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'provider-photos', 'provider-photos', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "Providers upload to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'provider-photos'
    and (storage.foldername(name))[1] = (select public.current_provider_slug())
  );

create policy "Providers replace their own photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'provider-photos'
    and (storage.foldername(name))[1] = (select public.current_provider_slug())
  );

create policy "Providers delete their own photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'provider-photos'
    and (storage.foldername(name))[1] = (select public.current_provider_slug())
  );

-- A listing may only reference the built-in images or its own uploaded photos,
-- so next/image never receives an arbitrary host.
create function public.valid_photo(p_url text)
returns boolean
language sql
immutable
as $$
  select p_url ~ '^/images/[a-z0-9._-]+$'
      or p_url ~ '^https://cfmetrbzfxjvywlvcbdk\.supabase\.co/storage/v1/object/public/provider-photos/[a-z0-9-]+/[A-Za-z0-9._-]+$'
$$;

create function public.valid_photos(p_urls text[])
returns boolean
language sql
immutable
as $$
  select coalesce(bool_and(public.valid_photo(u)), true) and cardinality(p_urls) <= 12
  from unnest(p_urls) as u
$$;

alter table public.providers
  add constraint providers_image_valid check (public.valid_photo(image)),
  add constraint providers_gallery_valid check (public.valid_photos(gallery)),
  add constraint providers_work_valid check (public.valid_photos(work));

grant update (image, gallery, work) on public.providers to authenticated;
