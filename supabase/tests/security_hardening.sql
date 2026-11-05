do $$
declare
  o uuid := gen_random_uuid(); c uuid := gen_random_uuid(); a uuid := gen_random_uuid(); s uuid := gen_random_uuid();
  sl text; sl2 text; r text := ''; n int; st text; bid uuid; d date := current_date + 3; pay int; rv record;
  base text := 'https://cfmetrbzfxjvywlvcbdk.supabase.co/storage/v1/object/public/provider-photos/';
begin
  -- the test providers stand in for providers who joined before the category catalogue
  update public.service_categories set open_to_new_providers = true, alias_of = null where slug in ('cleaning','plumbing');
  insert into auth.users (id, instance_id, aud, role, email) values
   (o,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','p@test.invalid'),
   (c,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','c@test.invalid'),
   (a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@test.invalid'),
   (s,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','s@test.invalid');
  update public.profiles set role='provider', phone='0821234567', full_name='Pat Provider' where id = o;
  update public.profiles set role='provider', phone='0827654321', full_name='Sam Self' where id = s;
  update public.profiles set full_name='Cora Customer' where id = c;
  update public.profiles set is_admin = true where id in (a, s);

  -- provider o builds a listing
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role','authenticated')::text, true);
  set local role authenticated;
  sl := public.create_my_listing('E2E Plumbing', 'plumbing', 'Sea Point', 'Cape Town');
  update public.provider_verification set video_path = sl||'/v.mp4' where provider_slug = sl;
  insert into public.provider_documents (provider_slug, kind, label, path) values (sl,'id','id.pdf',sl||'/id.pdf'),(sl,'certification','c.jpg',sl||'/c.jpg');
  insert into public.provider_services (provider_slug, name, from_price, position) values (sl,'Leak repair',450,0);
  insert into public.provider_hours (provider_slug, weekday, times) values (sl, extract(dow from d)::int, array['08:00','10:00','12:00']) on conflict (provider_slug, weekday) do update set times = excluded.times;
  update public.providers set about = repeat('Reliable plumbing. ',4), gallery = array[base||sl||'/1.jpg',base||sl||'/2.jpg',base||sl||'/3.jpg'] where slug = sl;
  reset role;
  perform set_config('request.jwt.claims','',true);
  -- 1 submit with no files uploaded must be blocked
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role','authenticated')::text, true);
  set local role authenticated;
  begin perform public.submit_for_review(); r := r || E'\n1 BAD submitted with no uploaded files';
  exception when others then r := r || E'\n1 submit without uploaded files blocked: ' || left(sqlerrm,120); end;
  reset role; perform set_config('request.jwt.claims','',true);
  insert into storage.objects (bucket_id, name) values ('provider-videos', sl||'/v.mp4'),('provider-docs', sl||'/id.pdf'),('provider-docs', sl||'/c.jpg');
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role','authenticated')::text, true);
  set local role authenticated; perform public.submit_for_review();
  -- 2 frozen while under review
  begin update public.providers set category='cleaning' where slug = sl; r := r || E'\n2 BAD category swap during review';
  exception when others then r := r || E'\n2 category swap during review blocked'; end;
  begin delete from public.provider_documents where provider_slug = sl and kind = 'certification'; get diagnostics n = row_count; r := r || E'\n2 doc delete during review rows: ' || n || ' (expect error)';
  exception when others then r := r || E'\n2 doc delete during review blocked'; end;
  reset role; perform set_config('request.jwt.claims','',true);

  -- 3 customer cannot read blockers; anon sees nothing of a pending listing
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true);
  set local role authenticated;
  begin perform public.review_blockers(sl); r := r || E'\n3 BAD customer read blockers';
  exception when others then r := r || E'\n3 customer review_blockers: ' || sqlerrm; end;
  reset role; perform set_config('request.jwt.claims','',true);
  set local role anon;
  select count(*) into n from public.provider_services where provider_slug = sl; r := r || E'\n3 anon sees services of pending listing: ' || n || ' (expect 0)';
  select count(*) into n from public.provider_hours where provider_slug = sl; r := r || E', hours: ' || n || ' (expect 0)';
  select count(*) into n from public.booked_times(sl, current_date, current_date+10); r := r || E', booked_times: ' || n;
  reset role;

  -- 4 admin vets and approves
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role','authenticated')::text, true);
  set local role authenticated;
  perform public.admin_set_vetting(sl,'intro_video_reviewed',true); perform public.admin_set_vetting(sl,'portfolio_reviewed',true);
  perform public.admin_set_vetting(sl,'contact_verified',true); perform public.admin_set_vetting(sl,'business_verified',true);
  perform public.admin_set_vetting(sl,'category_requirements_met',true); perform public.admin_set_vetting(sl,'documents_checked',true);
  perform public.admin_approve_provider(sl);
  reset role; perform set_config('request.jwt.claims','',true);
  select count(*) into n from public.providers where slug = sl and active and verified; r := r || E'\n4 approved is public: ' || n || ' (expect 1)';
  set local role anon;
  select count(*) into n from public.providers where slug = sl; r := r || E'\n4 anon sees provider: ' || n;
  select count(*) into n from public.provider_services where provider_slug = sl; r := r || E', services: ' || n;
  select count(*) into n from storage.objects where bucket_id='provider-videos' and name = sl||'/v.mp4'; r := r || E', anon sees approved video object: ' || n || ' (expect 1)';
  reset role;

  -- 5 after approval: category and document locks
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role','authenticated')::text, true);
  set local role authenticated;
  begin update public.providers set category='cleaning' where slug = sl; r := r || E'\n5 BAD category swap after approval';
  exception when others then r := r || E'\n5 category swap after approval blocked'; end;
  begin delete from public.provider_documents where provider_slug = sl and kind = 'id'; r := r || E'\n5 BAD id doc deleted after approval';
  exception when others then r := r || E'\n5 id doc delete after approval blocked'; end;
  update public.providers set about = repeat('Reliable plumbing, better now. ',3) where slug = sl;
  r := r || E'\n5 normal edit of about after approval: ok';
  -- provider cannot book own listing / fake earnings
  begin insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents, fee_cents)
    values ('SELF-1', o, sl, 'Leak repair', d, '10:00', '1 Long Street, Cape Town', 9999900, 0);
    r := r || E'\n5 BAD provider booked own listing';
  exception when others then r := r || E'\n5 self-booking blocked: ' || sqlerrm; end;
  reset role; perform set_config('request.jwt.claims','',true);

  -- 6 customer: valid booking has server-set price, bad bookings blocked
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true);
  set local role authenticated;
  insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents, fee_cents)
    values ('E2E-1', c, sl, 'Leak repair', d, '08:00', '1 Long Street, Cape Town', 1, 0) returning id into bid;
  select price_cents::text || '/' || fee_cents into st from public.bookings where id = bid;
  r := r || E'\n6 booking price/fee forced to: ' || st || ' (expect 45000/0)';
  begin insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents) values ('E2E-2', c, sl, 'Leak repair', d, '08:00', '2 Long Street, Cape Town', 45000);
    r := r || E'\n6 BAD double booking'; exception when unique_violation then r := r || E'\n6 double booking blocked'; end;
  begin insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents) values ('E2E-3', c, sl, 'Leak repair', d, '03:00', '2 Long Street, Cape Town', 45000);
    r := r || E'\n6 BAD out-of-hours booking'; exception when others then r := r || E'\n6 out-of-hours blocked: ' || sqlerrm; end;
  begin insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents) values ('E2E-4', c, sl, 'Leak repair', current_date - 10, '08:00', '2 Long Street, Cape Town', 45000);
    r := r || E'\n6 BAD past booking'; exception when others then r := r || E'\n6 past date blocked: ' || sqlerrm; end;
  begin insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents) values ('E2E-5', c, sl, 'Fake service', d, '10:00', '2 Long Street, Cape Town', 0);
    r := r || E'\n6 BAD fake service'; exception when others then r := r || E'\n6 fake service blocked: ' || sqlerrm; end;
  begin insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents) values ('E2E-6', c, 'ghost-provider', 'Leak repair', d, '10:00', '2 Long Street, Cape Town', 0);
    r := r || E'\n6 BAD ghost provider'; exception when others then r := r || E'\n6 ghost provider blocked: ' || sqlerrm; end;
  reset role; perform set_config('request.jwt.claims','',true);

  -- 7 confirm, reschedule, chat
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role','authenticated')::text, true);
  set local role authenticated; update public.bookings set status = 'confirmed' where id = bid; reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true);
  set local role authenticated; perform public.reschedule_booking(bid, d, '10:00');
  insert into public.messages (booking_id, body) values (bid, 'Is there parking?');
  insert into public.messages (booking_id, body, image_path) values (bid, '', bid||'/leak.jpg');
  begin insert into public.messages (booking_id, body, image_path) values (bid, 'x', bid||'/../evil.jpg'); r := r || E'\n7 BAD traversal image path';
  exception when others then r := r || E'\n7 image path with .. blocked'; end;
  reset role; perform set_config('request.jwt.claims','',true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role','authenticated')::text, true);
  set local role authenticated;
  begin insert into public.messages (booking_id, body) values (bid, 'Admin chatting'); r := r || E'\n7 BAD admin posted in chat';
  exception when others then r := r || E'\n7 admin cannot post in customer chat'; end;
  reset role; perform set_config('request.jwt.claims','',true);
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role','authenticated')::text, true);
  set local role authenticated; update public.bookings set status = 'confirmed' where id = bid;
  insert into public.messages (booking_id, body) values (bid, 'Yes, plenty outside.');
  select count(*) into n from public.messages where booking_id = bid; r := r || E'\n7 provider sees messages: ' || n || ' (expect 3)';
  reset role; perform set_config('request.jwt.claims','',true);

  -- 8 complete, review (forged provider and hidden flag are overridden), admin hides it
  update public.bookings set scheduled_date = current_date where id = bid;
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role','authenticated')::text, true);
  set local role authenticated; update public.bookings set status = 'awaiting_confirmation' where id = bid; reset role;
  perform set_config('request.jwt.claims','',true);
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true);
  set local role authenticated; update public.bookings set status = 'completed' where id = bid;
  insert into public.reviews (user_id, booking_id, provider_slug, rating, body, hidden) values (c, bid, 'bright-spark-electrical', 5, 'Great job', true);
  reset role; perform set_config('request.jwt.claims','',true);
  select provider_slug || '/hidden=' || hidden into st from public.reviews where booking_id = bid; r := r || E'\n8 stored review: ' || st || ' (expect ' || sl || '/hidden=false)';
  select rating::text || '/' || review_count into st from public.providers where slug = sl; r := r || E'\n8 provider rating/reviews: ' || st;
  select rating::text || '/' || review_count into st from public.providers where slug = 'bright-spark-electrical'; r := r || E'\n8 other provider untouched: ' || st;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role','authenticated')::text, true);
  set local role authenticated; perform public.admin_set_review_hidden((select id from public.reviews where booking_id = bid), true); reset role;
  perform set_config('request.jwt.claims','',true);
  select rating::text || '/' || review_count into st from public.providers where slug = sl; r := r || E'\n8 after admin hides review: ' || st || ' (expect 0.0/0 or 0/0)';

  -- 9 payout, then suspended provider cannot act
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role','authenticated')::text, true);
  set local role authenticated; select public.request_payout() into pay; r := r || E'\n9 payout requested cents: ' || pay || ' (expect 40500: R450 less 10%)'; reset role;
  perform set_config('request.jwt.claims','',true);
  insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents, fee_cents, status)
    values ('SUSP-1', c, sl, 'Leak repair', d, '12:00', '1 Long Street, Cape Town', 45000, 2500, 'pending');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role','authenticated')::text, true);
  set local role authenticated; perform public.admin_suspend_provider(sl, 'Testing suspension'); reset role;
  perform set_config('request.jwt.claims','',true);
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role','authenticated')::text, true);
  set local role authenticated;
  begin update public.bookings set status = 'confirmed' where reference = 'SUSP-1'; r := r || E'\n9 BAD suspended provider confirmed a job';
  exception when others then r := r || E'\n9 suspended provider confirm blocked: ' || sqlerrm; end;
  begin perform public.request_payout(); r := r || E'\n9 BAD suspended payout';
  exception when others then r := r || E'\n9 suspended payout blocked: ' || sqlerrm; end;
  reset role; perform set_config('request.jwt.claims','',true);
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true);
  begin insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents) values ('SUSP-2', c, sl, 'Leak repair', d, '10:00', '3 Long Street, Cape Town', 45000);
    r := r || E'\n9 BAD booked suspended provider'; exception when others then r := r || E'\n9 booking suspended provider blocked: ' || sqlerrm; end;
  reset role; perform set_config('request.jwt.claims','',true);

  -- 10 an admin who owns a listing cannot approve it
  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role','authenticated')::text, true);
  set local role authenticated; sl2 := public.create_my_listing('Self Admin Co', 'cleaning', 'Gardens', 'Cape Town'); reset role;
  perform set_config('request.jwt.claims','',true);
  update public.provider_verification set status = 'pending_review' where provider_slug = sl2;
  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role','authenticated')::text, true);
  set local role authenticated;
  begin perform public.admin_set_vetting(sl2,'intro_video_reviewed',true); r := r || E'\n10 BAD admin ticked own listing';
  exception when others then r := r || E'\n10 self-tick blocked: ' || sqlerrm; end;
  reset role; perform set_config('request.jwt.claims','',true);
  update public.provider_verification set intro_video_reviewed=true, portfolio_reviewed=true, contact_verified=true, business_verified=true, category_requirements_met=true, documents_checked=true where provider_slug = sl2;
  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role','authenticated')::text, true);
  set local role authenticated;
  begin perform public.admin_approve_provider(sl2); r := r || E'\n10 BAD admin approved own listing';
  exception when others then r := r || E'\n10 self-approval blocked: ' || left(sqlerrm,100); end;
  reset role; perform set_config('request.jwt.claims','',true);

  raise exception '%', r;
end $$;
