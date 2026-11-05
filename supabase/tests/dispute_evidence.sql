-- Dispute evidence: the RPC registers an uploaded file, rejects bad paths, caps photos, and refuses
-- outsiders and decided disputes. Ends in a deliberate error so nothing is kept. Any "BAD" line is a failure.
create function pg_temp.as_user(u uuid) returns void language plpgsql as $f$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role','authenticated')::text, true); execute 'set local role authenticated'; end $f$;
create function pg_temp.as_owner() returns void language plpgsql as $f$
begin execute 'reset role'; perform set_config('request.jwt.claims','',true); end $f$;

do $$
declare o uuid := gen_random_uuid(); c uuid := gen_random_uuid(); x uuid := gen_random_uuid(); sl text; r text := ''; b uuid; dsp uuid; p text; n int; k int;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
   (o,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','ep@test.invalid'),
   (c,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','ec@test.invalid'),
   (x,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','ex@test.invalid');
  update public.profiles set role='provider', phone='0821234567' where id = o;
  perform pg_temp.as_user(o);
  sl := public.create_my_listing('Evidence Test', 'cleaning', 'Gardens', 'Cape Town');
  insert into public.provider_services (provider_slug, name, from_price, position) values (sl, 'Clean', 300, 0);
  perform pg_temp.as_owner();
  insert into public.provider_hours (provider_slug, weekday, times) select sl, g, array['08:00'] from generate_series(0,6) g on conflict (provider_slug, weekday) do update set times = excluded.times;
  update public.provider_verification set status = 'approved' where provider_slug = sl;
  insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents)
  values ('EV-1', c, sl, 'Clean', current_date + 5, '08:00', '1 Long Street, Cape Town', 30000) returning id into b;
  update public.bookings set status='confirmed', scheduled_date = current_date - 1 where id = b;
  perform pg_temp.as_user(o); update public.bookings set status='awaiting_confirmation' where id = b;
  perform pg_temp.as_user(c); dsp := public.report_booking_issue(b, 'not_done', 'The garden was not cut at all');
  perform pg_temp.as_owner();
  for k in 1..7 loop
    insert into storage.objects (bucket_id, name, owner_id) values ('dispute-evidence', dsp||'/'||c||'/f'||k||'.png', c::text);
  end loop;
  insert into storage.objects (bucket_id, name, owner_id) values ('dispute-evidence', dsp||'/'||x||'/o.png', x::text);

  perform pg_temp.as_user(c);
  begin perform public.add_dispute_evidence(dsp, dsp||'/'||c||'/f1.png', 'image/png', 70); r := r || E'\n1 customer registers an uploaded photo: ok';
  exception when others then r := r || E'\n1 BAD customer could not register a photo: ' || sqlerrm; end;
  begin perform public.add_dispute_evidence(dsp, dsp||'/'||c||'/missing.png', 'image/png', 70); r := r || E'\n2 BAD registered a file that was never uploaded';
  exception when others then r := r || E'\n2 missing file rejected: ' || sqlerrm; end;
  begin perform public.add_dispute_evidence(dsp, dsp||'/'||x||'/o.png', 'image/png', 70); r := r || E'\n3 BAD registered a file in someone else''s folder';
  exception when others then r := r || E'\n3 foreign folder rejected: ' || sqlerrm; end;
  for k in 2..6 loop perform public.add_dispute_evidence(dsp, dsp||'/'||c||'/f'||k||'.png', 'image/png', 70); end loop;
  begin perform public.add_dispute_evidence(dsp, dsp||'/'||c||'/f7.png', 'image/png', 70); r := r || E'\n4 BAD seventh photo accepted';
  exception when others then r := r || E'\n4 seventh photo rejected: ' || sqlerrm; end;
  perform pg_temp.as_user(x);
  begin perform public.add_dispute_evidence(dsp, dsp||'/'||x||'/o.png', 'image/png', 70); r := r || E'\n5 BAD outsider added evidence';
  exception when others then r := r || E'\n5 outsider rejected: ' || sqlerrm; end;
  select count(*) into n from public.dispute_evidence; r := r || E'\n5 outsider sees evidence rows: ' || n || ' (expect 0)';
  perform pg_temp.as_owner();
  select count(*) into n from public.dispute_evidence where dispute_id = dsp; r := r || E'\n6 evidence rows stored: ' || n || ' (expect 6)';
  raise exception '%', r;
end $$;
