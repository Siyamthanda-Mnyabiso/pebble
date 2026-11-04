-- Providers belong to a city. Customers see providers in their city, not a tiny radius.

alter table public.providers add column city text not null default 'Cape Town';
create index providers_city_idx on public.providers (city) where active;

grant update (city) on public.providers to authenticated;

drop function public.create_my_listing(text, text, text);

create function public.create_my_listing(p_name text, p_category text, p_area text, p_city text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  base text;
  candidate text;
  img text;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if not exists (
    select 1 from public.profiles where id = uid and role = 'provider' and provider_slug is null
  ) then
    raise exception 'This account cannot create a listing';
  end if;

  base := trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'));
  if char_length(base) < 3 then base := 'provider'; end if;
  base := left(base, 50);
  candidate := base;
  while exists (select 1 from public.providers where slug = candidate) loop
    candidate := base || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  img := case p_category
    when 'plumbing' then '/images/work-pipework.jpg'
    when 'painting' then '/images/hero-painter.jpg'
    else '/images/' || p_category || '.jpg'
  end;

  insert into public.providers (slug, name, category, area, city, image, gallery, work)
  values (candidate, trim(p_name), p_category, trim(p_area), trim(p_city), img, array[img], array[img]);

  insert into public.provider_hours (provider_slug, weekday, times)
  select candidate, d,
    case when d between 1 and 5 then array['08:00','10:00','12:00','14:00','16:00']
         when d = 6 then array['08:00','10:00'] else '{}'::text[] end
  from generate_series(0, 6) d;

  update public.profiles set provider_slug = candidate where id = uid;
  return candidate;
end;
$$;

revoke execute on function public.create_my_listing(text, text, text, text) from public, anon;
grant execute on function public.create_my_listing(text, text, text, text) to authenticated;

-- The sample providers' "area" was just the city; make it a suburb.
update public.providers set area = 'Central' where area = 'Cape Town';

-- How many providers each city has, for the city picker.
create function public.provider_cities()
returns table (city text, providers bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.city, count(*) from public.providers p
  where p.active and exists (select 1 from public.provider_services s where s.provider_slug = p.slug)
  group by p.city
$$;
grant execute on function public.provider_cities() to anon, authenticated;
