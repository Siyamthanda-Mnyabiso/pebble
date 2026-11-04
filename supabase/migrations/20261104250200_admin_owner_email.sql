-- Admins checking a provider's contact details need to see the sign-in email.
create function public.admin_owner_email(p_slug text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare mail text;
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  select u.email into mail from public.profiles p join auth.users u on u.id = p.id where p.provider_slug = p_slug;
  return mail;
end;
$$;
revoke execute on function public.admin_owner_email(text) from public, anon;
grant execute on function public.admin_owner_email(text) to authenticated;
