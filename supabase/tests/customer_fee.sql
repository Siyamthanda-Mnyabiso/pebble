do $$
declare o uuid := gen_random_uuid(); c uuid := gen_random_uuid(); a uuid := gen_random_uuid(); sl text; r text := ''; st text; n int; b1 uuid; d date := current_date + 3;
begin
  -- the test providers stand in for providers who joined before the category catalogue
  update public.service_categories set open_to_new_providers = true, alias_of = null where slug in ('cleaning','plumbing');
  insert into auth.users (id, instance_id, aud, role, email) values
   (o,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','p@test.invalid'),
   (c,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','c@test.invalid'),
   (a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@test.invalid');
  update public.profiles set role='provider', phone='0821234567' where id = o;
  update public.profiles set is_admin = true where id = a;
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role','authenticated')::text, true); set local role authenticated;
  sl := public.create_my_listing('Fee Test', 'cleaning', 'Gardens', 'Cape Town');
  insert into public.provider_services (provider_slug, name, from_price, position) values (sl, 'Clean', 300, 0);
  insert into public.provider_hours (provider_slug, weekday, times) values (sl, extract(dow from d)::int, array['08:00']) on conflict (provider_slug, weekday) do update set times = excluded.times;
  reset role; perform set_config('request.jwt.claims','',true);
  update public.provider_verification set status = 'approved' where provider_slug = sl;
  select value::text into st from public.platform_settings where key='customer_fee_cents'; r := r || E'\n1 customer fee setting: ' || st || ' (expect 0)';
  select count(*) into n from public.bookings where fee_cents <> 0; r := r || E'\n1 bookings with a fee: ' || n || ' (expect 0)';
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true); set local role authenticated;
  insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents, fee_cents) values ('FEE-1', c, sl, 'Clean', d, '08:00', '1 Long Street, Cape Town', 1, 9999) returning id into b1;
  reset role; perform set_config('request.jwt.claims','',true);
  select price_cents||'/'||fee_cents||'/'||commission_cents||'/'||earning_cents into st from public.bookings where id = b1;
  r := r || E'\n2 R300 service, price/fee/commission/earning cents: ' || st || ' (expect 30000/0/3000/27000)';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role','authenticated')::text, true); set local role authenticated;
  begin perform public.admin_set_setting('customer_fee_cents', 500); r := r || E'\n3 BAD admin set a customer fee'; exception when others then r := r || E'\n3 customer fee blocked: ' || sqlerrm; end;
  perform public.admin_set_setting('commission_percent', 8);
  perform public.admin_set_setting('commission_percent', 10);
  perform public.admin_set_setting('commission_percent', 10);
  select count(*) into n from public.platform_settings_log where key = 'commission_percent'; r := r || E'\n4 audit entries for two real changes (no-op ignored): ' || n || ' (expect 2)';
  select string_agg(old_value||'->'||new_value, ', ' order by changed_at) into st from public.platform_settings_log where key='commission_percent'; r := r || E' [' || st || ']';
  reset role; perform set_config('request.jwt.claims','',true);
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.platform_settings_log; r := r || E'\n4 customer can read the settings log: ' || n || ' (expect 0)';
  reset role; perform set_config('request.jwt.claims','',true);
  raise exception '%', r;
end $$;
