-- A payout can only be requested for completed jobs the customer has paid for. Ends in a deliberate error.
create function pg_temp.as_user(u uuid) returns void language plpgsql as $f$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role','authenticated')::text, true); execute 'set local role authenticated'; end $f$;
create function pg_temp.as_owner() returns void language plpgsql as $f$
begin execute 'reset role'; perform set_config('request.jwt.claims','',true); end $f$;

do $$
declare o uuid := gen_random_uuid(); c uuid := gen_random_uuid(); sl text; r text := ''; b uuid; n int;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
   (o,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','pp@test.invalid'),
   (c,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','pc@test.invalid');
  update public.profiles set role='provider', phone='0821234567' where id = o;
  perform pg_temp.as_user(o);
  sl := public.create_my_listing('Payout Test', 'cleaning', 'Gardens', 'Cape Town');
  insert into public.provider_services (provider_slug, name, from_price, position) values (sl, 'Clean', 300, 0);
  perform pg_temp.as_owner();
  insert into public.provider_hours (provider_slug, weekday, times) select sl, g, array['08:00'] from generate_series(0,6) g on conflict (provider_slug, weekday) do update set times = excluded.times;
  update public.provider_verification set status = 'approved' where provider_slug = sl;
  insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents)
  values ('PP-1', c, sl, 'Clean', current_date + 5, '08:00', '1 Long Street, Cape Town', 30000) returning id into b;
  update public.bookings set status='confirmed', scheduled_date = current_date - 1 where id = b;
  perform pg_temp.as_user(o); update public.bookings set status='awaiting_confirmation' where id = b;
  perform pg_temp.as_user(c); update public.bookings set status='completed' where id = b;
  perform pg_temp.as_user(o);
  n := public.payout_balance(); r := r || E'\n1 balance on an unpaid completed job: ' || n || (case when n = 0 then ' ok' else ' BAD' end);
  begin perform public.request_payout(); r := r || E'\n2 BAD payout requested on an unpaid job';
  exception when others then r := r || E'\n2 payout on unpaid job refused: ' || sqlerrm; end;
  perform pg_temp.as_owner();
  update public.bookings set payment_status = 'paid' where id = b;
  perform pg_temp.as_user(o);
  n := public.payout_balance(); r := r || E'\n3 balance once paid: ' || n || (case when n = 27000 then ' ok' else ' BAD' end);
  perform pg_temp.as_owner();
  raise exception '%', r;
end $$;
