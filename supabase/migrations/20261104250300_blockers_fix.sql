-- Appending a text literal to an array needs an explicit cast.

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
  if v.intro_video_url = '' then prov := array_append(prov, 'Add a link to your intro video'::text); end if;
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

