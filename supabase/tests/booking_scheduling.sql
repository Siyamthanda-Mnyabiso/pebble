
do $$
declare
  o uuid := gen_random_uuid(); c uuid := gen_random_uuid(); a uuid := gen_random_uuid();
  sl text; r text := ''; n int; st text; x text; b1 uuid; b2 uuid; b3 uuid; b4 uuid; b5 uuid; b6 uuid;
  d date := current_date + 3; d2 date := current_date + 4; dl timestamptz; sa timestamp := now() at time zone 'Africa/Johannesburg';
begin
  -- the test providers stand in for providers who joined before the category catalogue
  update public.service_categories set open_to_new_providers = true, alias_of = null where slug in ('cleaning','plumbing');
  insert into auth.users (id, instance_id, aud, role, email) values
   (o,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','p@test.invalid'),
   (c,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','c@test.invalid'),
   (a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@test.invalid');
  update public.profiles set role='provider', phone='0821234567', full_name='Pat Provider' where id = o;
  update public.profiles set full_name='Cora Customer' where id = c;
  update public.profiles set is_admin = true where id = a;

  -- provider builds a listing with services, hours and a booking preference row
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role','authenticated')::text, true); set local role authenticated;
  sl := public.create_my_listing('QA Clean', 'cleaning', 'Gardens', 'Cape Town');
  insert into public.provider_services (provider_slug, name, from_price, position, duration_minutes, instant_booking) values
    (sl, 'Standard clean', 500, 0, 120, false), (sl, 'Quick clean', 300, 1, 60, true), (sl, 'Old service', 200, 2, 60, false);
  update public.provider_services set active = false where provider_slug = sl and name = 'Old service';
  insert into public.provider_hours (provider_slug, weekday, times) values
    (sl, extract(dow from d)::int, array['08:00','10:00','12:00','14:00']),
    (sl, extract(dow from d2)::int, array['08:00','10:00','12:00','14:00'])
    on conflict (provider_slug, weekday) do update set times = excluded.times;
  insert into public.provider_booking_settings (provider_slug, buffer_minutes, max_daily_bookings) values (sl, 30, 3);
  reset role; perform set_config('request.jwt.claims','',true);
  update public.provider_verification set status = 'approved' where provider_slug = sl;
  select count(*) into n from public.providers where slug = sl and active; r := r || E'\n0 test provider live: ' || n;

  -- settings
  select (public.public_booking_settings() ->> 'commission_percent') into st; r := r || E'\n1 commission shown to public: ' || st;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true); set local role authenticated;
  begin perform public.admin_set_setting('commission_percent', 99); r := r || E'\n1 customer set setting BAD: customer changed a setting'; exception when others then r := r || E'\n1 customer set setting blocked: ' || left(sqlerrm,90); end;
  reset role; perform set_config('request.jwt.claims','',true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role','authenticated')::text, true); set local role authenticated;
  perform public.admin_set_setting('commission_percent', 12);
  begin perform public.admin_set_setting('commission_percent', 80); r := r || E'\n1 out of range BAD: accepted 80 percent'; exception when others then r := r || E'\n1 out of range blocked: ' || left(sqlerrm,90); end;
  begin perform public.admin_set_setting('payments_enabled', 1); r := r || E'\n1 payments on without gateway BAD: payments switched on'; exception when others then r := r || E'\n1 payments on without gateway blocked: ' || left(sqlerrm,90); end;
  perform public.admin_set_setting('commission_percent', 10);
  reset role; perform set_config('request.jwt.claims','',true);

  -- services: inactive is hidden and unbookable
  set local role anon;
  select count(*) into n from public.provider_services where provider_slug = sl; r := r || E'\n2 anon sees services: ' || n || ' (expect 2, inactive hidden)';
  reset role;

  -- request mode booking (payments off): price, commission, deadline
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true); set local role authenticated;
  insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents, fee_cents) values ('BK-1', c, sl, 'Standard clean', d, '08:00', '1 Long Street, Cape Town', 1, 0) returning id into b1;
  reset role; perform set_config('request.jwt.claims','',true);
  select price_cents||'/'||fee_cents||'/'||commission_cents||'/'||earning_cents||'/'||status||'/'||booking_mode||'/'||duration_minutes into st from public.bookings where id = b1;
  r := r || E'\n3 request booking price/fee/commission/earning/status/mode/duration: ' || st || ' (expect 50000/0/5000/45000/pending/request/120)';
  select (expires_at is not null and expires_at <= now() + interval '25 hours' and expires_at > now() + interval '23 hours')::text into st from public.bookings where id = b1;
  r := r || E'\n3 future request deadline about 24h: ' || st;
  dl := public.response_deadline(((sa + interval '3 hours')::date), ((sa + interval '3 hours')::time));
  r := r || E'\n3 urgent deadline minutes from now: ' || round(extract(epoch from (dl - now()))/60)::int || ' (expect about 30)';
  select (count(*)) into n from public.notifications where user_id = o and kind = 'booking_request'; r := r || E'\n3 provider notified: ' || n;

  -- overlap with buffer: 08:00 (120 min) + 30 buffer => 10:00 blocked, 12:00 free
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true); set local role authenticated;
  begin insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents, fee_cents) values ('BK-2', c, sl, 'Quick clean', d, '10:00', '1 Long Street, Cape Town', 1, 0); r := r || E'\n4 overlap at 10:00 BAD: overlap allowed'; exception when others then r := r || E'\n4 overlap at 10:00 blocked: ' || left(sqlerrm,90); end;
  reset role; perform set_config('request.jwt.claims','',true);
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true); set local role authenticated;
  insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents, fee_cents) values ('BK-3', c, sl, 'Quick clean', d, '12:00', '1 Long Street, Cape Town', 1, 0) returning id into b2;
  reset role; perform set_config('request.jwt.claims','',true);
  r := r || E'\n4 12:00 after buffer allowed';
  select string_agg(t, ',' order by t) into st from public.available_slots(sl, d, d, 'Quick clean'); r := r || E'\n4 open times left that day: ' || coalesce(st,'none') || ' (expect 14:00 only)';
  select string_agg(t, ',' order by t) into st from public.booked_times(sl, d, d); r := r || E'\n4 booked_times for old screens: ' || coalesce(st,'none') || ' (expect 08:00,10:00,12:00)';

  -- daily capacity of 3
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true); set local role authenticated;
  insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents, fee_cents) values ('BK-4', c, sl, 'Quick clean', d, '14:00', '1 Long Street, Cape Town', 1, 0) returning id into b3;
  reset role; perform set_config('request.jwt.claims','',true);
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true); set local role authenticated;
  begin insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents, fee_cents) values ('BK-5', c, sl, 'Quick clean', d, '14:00', '1 Long Street, Cape Town', 1, 0); r := r || E'\n5 fourth booking over daily cap BAD: over capacity'; exception when others then r := r || E'\n5 fourth booking over daily cap blocked: ' || left(sqlerrm,90); end;
  reset role; perform set_config('request.jwt.claims','',true);

  -- expiry frees the slot and the sweep notifies the customer
  update public.bookings set expires_at = now() - interval '1 minute' where id = b3;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true); set local role authenticated;
  insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents, fee_cents) values ('BK-6', c, sl, 'Quick clean', d, '14:00', '1 Long Street, Cape Town', 1, 0) returning id into b4;
  reset role; perform set_config('request.jwt.claims','',true);
  r := r || E'\n6 slot reusable once an unanswered request is past its deadline';
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role','authenticated')::text, true); set local role authenticated;
  begin update public.bookings set status = 'confirmed' where id = b3; r := r || E'\n6 provider accepts an expired request BAD: accepted expired request'; exception when others then r := r || E'\n6 provider accepts an expired request blocked: ' || left(sqlerrm,90); end;
  reset role; perform set_config('request.jwt.claims','',true);
  select public.expire_stale_bookings() into n; r := r || E'\n6 sweep expired: ' || n || ' (expect 1)';
  select status::text into st from public.bookings where id = b3; r := r || E', status: ' || st;
  select count(*) into n from public.notifications where user_id = c and kind = 'booking_expired'; r := r || E', customer told: ' || n;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.alternative_providers(b3); reset role; perform set_config('request.jwt.claims','',true);
  r := r || E'\n6 alternative providers suggested: ' || n || ' (expect >=1)';

  -- legacy lifecycle while payments are off: provider confirms, completes on the day
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role','authenticated')::text, true); set local role authenticated;
  update public.bookings set status = 'confirmed' where id = b1;
  begin update public.bookings set status = 'completed' where id = b1; r := r || E'\n7 provider completes before the date BAD: completed early'; exception when others then r := r || E'\n7 provider completes before the date blocked: ' || left(sqlerrm,90); end;
  reset role; perform set_config('request.jwt.claims','',true);
  update public.bookings set scheduled_date = current_date where id = b1;
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role','authenticated')::text, true); set local role authenticated;
  update public.bookings set status = 'awaiting_confirmation' where id = b1;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true); set local role authenticated;
  update public.bookings set status = 'completed' where id = b1;
  reset role; perform set_config('request.jwt.claims','',true);
  r := r || E'\n7 confirm, provider marks done, customer confirms (payments off)';
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role','authenticated')::text, true); set local role authenticated;
  select public.payout_balance() into n; r := r || E'\n7 payout balance after commission: ' || n || ' (expect 45000)';
  reset role; perform set_config('request.jwt.claims','',true);

  -- reschedule still works
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true); set local role authenticated;
  perform public.reschedule_booking(b2, d2, '10:00');
  reset role; perform set_config('request.jwt.claims','',true);
  select status::text||'/'||scheduled_date into st from public.bookings where id = b2; r := r || E'\n8 reschedule moved booking: ' || st;
  select (expires_at is not null)::text into st from public.bookings where id = b2; r := r || E', has new deadline: ' || st;

  -- payments ON (simulated inside this rolled back test only): instant vs request
  update public.platform_settings set value = 1 where key in ('payments_enabled','gateway_ready');
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true); set local role authenticated;
  insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents, fee_cents) values ('BK-7', c, sl, 'Quick clean', d2, '12:00', '1 Long Street, Cape Town', 1, 0) returning id into b5;
  insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents, fee_cents) values ('BK-8', c, sl, 'Standard clean', d2, '14:00', '1 Long Street, Cape Town', 1, 0) returning id into b6;
  reset role; perform set_config('request.jwt.claims','',true);
  select status::text||'/'||booking_mode||'/'||(expires_at <= now() + interval '16 minutes' and expires_at > now() + interval '14 minutes')::text into st from public.bookings where id = b5;
  r := r || E'\n9 instant service: ' || st || ' (expect awaiting_payment/instant/true)';
  select status::text||'/'||booking_mode into st from public.bookings where id = b6; r := r || E', request service: ' || st;
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role','authenticated')::text, true); set local role authenticated;
  begin update public.bookings set status = 'confirmed' where id = b6; r := r || E'\n9 provider confirms without payment BAD: confirmed without payment'; exception when others then r := r || E'\n9 provider confirms without payment blocked: ' || left(sqlerrm,90); end;
  begin update public.bookings set status = 'confirmed' where id = b5; r := r || E'\n9 provider acts on instant booking awaiting payment BAD: provider confirmed instant booking'; exception when others then r := r || E'\n9 provider acts on instant booking awaiting payment blocked: ' || left(sqlerrm,90); end;
  update public.bookings set status = 'awaiting_payment' where id = b6;
  reset role; perform set_config('request.jwt.claims','',true);
  select status::text||'/'||(expires_at <= now() + interval '16 minutes')::text into st from public.bookings where id = b6; r := r || E'\n9 accepted request now: ' || st || ' (expect awaiting_payment/true)';
  select count(*) into n from public.notifications where user_id = c and kind = 'booking_awaiting_payment'; r := r || E', customer asked to pay: ' || n;

  -- chat is locked until confirmed
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true); set local role authenticated;
  begin insert into public.messages (booking_id, body) values (b6, 'hello'); r := r || E'\n10 chat before payment BAD: message sent before confirmation'; exception when others then r := r || E'\n10 chat before payment blocked: ' || left(sqlerrm,90); end;
  reset role; perform set_config('request.jwt.claims','',true);
  update public.bookings set status = 'confirmed', payment_status = 'paid' where id = b6;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true); set local role authenticated;
  insert into public.messages (booking_id, body) values (b6, 'hello after confirmation');
  reset role; perform set_config('request.jwt.claims','',true);
  r := r || E'\n10 chat open after confirmation';

  -- completion: provider marks finished, customer confirms; second job disputed
  update public.bookings set scheduled_date = current_date where id in (b6, b5);
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role','authenticated')::text, true); set local role authenticated;
  begin update public.bookings set status = 'completed' where id = b6; r := r || E'\n11 provider marks complete directly BAD: completed without customer confirm'; exception when others then r := r || E'\n11 provider marks complete directly blocked: ' || left(sqlerrm,90); end;
  update public.bookings set status = 'awaiting_confirmation' where id = b6;
  reset role; perform set_config('request.jwt.claims','',true);
  select count(*) into n from public.notifications where user_id = c and kind = 'booking_awaiting_confirmation'; r := r || E'\n11 customer asked to confirm: ' || n;
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role','authenticated')::text, true); set local role authenticated;
  begin update public.bookings set status = 'completed' where id = b6; r := r || E'\n11 provider confirms own completion BAD: provider self-confirmed'; exception when others then r := r || E'\n11 provider confirms own completion blocked: ' || left(sqlerrm,90); end;
  reset role; perform set_config('request.jwt.claims','',true);
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true); set local role authenticated;
  update public.bookings set status = 'completed' where id = b6;
  reset role; perform set_config('request.jwt.claims','',true);
  r := r || E'\n11 customer confirmed completion';
  update public.bookings set status = 'confirmed' where id = b5; update public.bookings set status = 'awaiting_confirmation' where id = b5;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true); set local role authenticated;
  update public.bookings set status = 'disputed' where id = b5;
  reset role; perform set_config('request.jwt.claims','',true);
  select count(*) into n from public.notifications where user_id = o and kind = 'booking_disputed'; r := r || E'\n11 dispute: provider notified ' || n;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true); set local role authenticated;
  begin update public.bookings set status = 'completed' where id = b5; r := r || E'\n11 customer resolves own dispute BAD: customer resolved dispute'; exception when others then r := r || E'\n11 customer resolves own dispute blocked: ' || left(sqlerrm,90); end;
  reset role; perform set_config('request.jwt.claims','',true);
  select status::text into st from public.bookings where id = b5; r := r || E'\n11 disputed booking stays disputed until an admin resolves it (step 3): ' || st;

  -- decline path
  update public.platform_settings set value = 0 where key in ('payments_enabled','gateway_ready');
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true); set local role authenticated;
  insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents, fee_cents) values ('BK-9', c, sl, 'Quick clean', d + 7, '08:00', '1 Long Street, Cape Town', 1, 0) returning id into b4;
  reset role; perform set_config('request.jwt.claims','',true);
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role','authenticated')::text, true); set local role authenticated;
  update public.bookings set status = 'declined' where id = b4;
  reset role; perform set_config('request.jwt.claims','',true);
  select count(*) into n from public.notifications where user_id = c and kind = 'booking_declined'; r := r || E'\n12 decline: customer told ' || n;
  select count(*) into n from public.booking_events where booking_id = b4 and kind = 'declined'; r := r || E', logged: ' || n;

  -- scheduled expiry
  begin
    execute 'select count(*) from cron.job where jobname = ''expire-stale-bookings''' into n;
    r := r || E'\n13 scheduled expiry job present: ' || n;
  exception when others then r := r || E'\n13 scheduled expiry job NOT set up: ' || left(sqlerrm, 80); end;

  raise exception '%', r;
end $$;
