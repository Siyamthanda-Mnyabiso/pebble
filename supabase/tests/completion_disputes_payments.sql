
create function pg_temp.as_user(u uuid) returns void language plpgsql as $f$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role','authenticated')::text, true); execute 'set local role authenticated'; end $f$;
create function pg_temp.as_owner() returns void language plpgsql as $f$
begin execute 'reset role'; perform set_config('request.jwt.claims','',true); end $f$;

do $$
declare o uuid := gen_random_uuid(); c uuid := gen_random_uuid(); a uuid := gen_random_uuid(); sl text; r text := ''; st text; n int; d date := current_date + 3;
  b1 uuid; b2 uuid; b3 uuid; b4 uuid; b5 uuid; b6 uuid; b7 uuid; b8 uuid; b9 uuid; b10 uuid; dsp uuid; dsp2 uuid; res text; k int := 0;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
   (o,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','p@test.invalid'),
   (c,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','c@test.invalid'),
   (a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@test.invalid');
  update public.profiles set role='provider', phone='0821234567' where id = o;
  update public.profiles set is_admin = true where id = a;
  perform pg_temp.as_user(o);
  sl := public.create_my_listing('Done Test', 'cleaning', 'Gardens', 'Cape Town');
  insert into public.provider_services (provider_slug, name, from_price, position) values (sl, 'Clean', 300, 0);
  perform pg_temp.as_owner();
  insert into public.provider_hours (provider_slug, weekday, times) select sl, g, array['08:00'] from generate_series(0,6) g on conflict (provider_slug, weekday) do update set times = excluded.times;
  update public.provider_verification set status = 'approved' where provider_slug = sl;
  -- ten bookings, all confirmed and dated yesterday so the job can be marked done
  for k in 1..10 loop
    insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents)
    values ('DN-'||k, c, sl, 'Clean', current_date + 10 + k, '08:00', '1 Long Street, Cape Town', 30000);
  end loop;
  update public.bookings set status='confirmed', scheduled_date = current_date - (right(reference,length(reference)-3))::int where reference like 'DN-%';
  select id into b1 from public.bookings where reference='DN-1'; select id into b2 from public.bookings where reference='DN-2'; select id into b3 from public.bookings where reference='DN-3';
  select id into b4 from public.bookings where reference='DN-4'; select id into b5 from public.bookings where reference='DN-5'; select id into b6 from public.bookings where reference='DN-6';
  select id into b7 from public.bookings where reference='DN-7'; select id into b8 from public.bookings where reference='DN-8'; select id into b9 from public.bookings where reference='DN-9'; select id into b10 from public.bookings where reference='DN-10';
  select commission_cents||'/'||earning_cents into st from public.bookings where id = b1; r := r || E'\n0 commission/earning on insert as postgres: ' || st;

  -- 1 completion flow
  perform pg_temp.as_user(o);
  begin update public.bookings set status='completed' where id=b1; get diagnostics n = row_count; r := r || E'\n1 BAD provider completed directly'; exception when others then r := r || E'\n1 provider cannot complete directly: ' || sqlerrm; end;
  update public.bookings set status='awaiting_confirmation' where id=b1;
  perform pg_temp.as_owner();
  select status::text||' confirm_by in '||round(extract(epoch from confirm_by-now())/3600)||'h' into st from public.bookings where id=b1; r := r || E'\n1 provider marks done: ' || st || ' (expect awaiting_confirmation, 24h)';
  select count(*) into n from public.notifications where user_id=c and kind='booking_awaiting_confirmation'; r := r || E'\n1 customer notified: ' || n;
  perform pg_temp.as_user(o);
  begin update public.bookings set status='completed' where id=b1; r := r || E'\n1 BAD provider confirmed own job'; exception when others then r := r || E'\n1 provider cannot confirm own job: ' || sqlerrm; end;
  perform pg_temp.as_user(c);
  update public.bookings set status='completed' where id=b1;
  perform pg_temp.as_owner();
  select status::text||' completed_at set='||(completed_at is not null) into st from public.bookings where id=b1; r := r || E'\n1 customer confirms: ' || st;

  -- 2 customer reports a problem
  perform pg_temp.as_user(o); update public.bookings set status='awaiting_confirmation' where id in (b2,b3,b4,b5);
  perform pg_temp.as_user(c);
  begin perform public.report_booking_issue(b2, 'not_done', 'short'); r := r || E'\n2 BAD short report accepted'; exception when others then r := r || E'\n2 too-short report rejected: ' || left(sqlerrm,50); end;
  begin perform public.report_booking_issue(b6, 'not_done', 'The kitchen was not cleaned at all'); r := r || E'\n2 BAD reported a job not awaiting confirmation'; exception when others then r := r || E'\n2 report on wrong status rejected: ' || sqlerrm; end;
  dsp := public.report_booking_issue(b2, 'not_done', 'The kitchen was not cleaned as agreed');
  dsp2 := public.report_booking_issue(b3, 'poor_quality', 'Two bedrooms were left dirty');
  perform public.report_booking_issue(b4, 'no_show', 'Nobody ever arrived at the address');
  perform pg_temp.as_owner();
  select b.status::text||' payout='||b.payout_status||' confirm_by null='||(b.confirm_by is null) into st from public.bookings b where id=b2; r := r || E'\n2 reported: ' || st || ' (expect disputed on_hold)';
  select count(*) into n from public.notifications where user_id=o and kind='booking_disputed'; r := r || E'\n2 provider notified: ' || (n>0)::text;
  select count(*) into n from public.notifications where user_id=a; r := r || E'\n2 admins notified: ' || n;
  -- an auto-complete sweep must never touch a disputed job
  update public.bookings set confirm_by = now() - interval '1 hour' where id in (b2, b5);
  select public.complete_stale_confirmations() into n; r := r || E'\n2 sweep completed ' || n || ' (expect 1: b5 only, b2 disputed stays)';
  select status::text into st from public.bookings where id=b2; r := r || E', disputed job still: ' || st;
  select status::text||' payout='||payout_status into st from public.bookings where id=b5; r := r || E'; stale one: ' || st;

  -- 3 provider reply, evidence of messages
  perform pg_temp.as_user(o);
  perform public.reply_to_dispute(dsp, 'The job was done and the customer left happy');
  begin perform public.reply_to_dispute(dsp, 'Another reply'); r := r || E'\n3 BAD second reply'; exception when others then r := r || E'\n3 second reply rejected: ' || sqlerrm; end;
  perform pg_temp.as_owner();
  insert into public.messages (booking_id, sender_id, body) values (b2, c, 'The kitchen is still dirty');
  perform pg_temp.as_user(c);
  begin perform public.resolve_dispute(dsp, 'refund_customer', 'Refunding in full'); r := r || E'\n3 BAD customer decided own dispute'; exception when others then r := r || E'\n3 customer cannot decide: ' || sqlerrm; end;
  begin perform public.reply_to_dispute(dsp2, 'Customer replying as provider'); r := r || E'\n3 BAD customer replied as provider'; exception when others then r := r || E'\n3 customer cannot reply as provider: ' || sqlerrm; end;
  perform pg_temp.as_user(a);
  select count(*) into n from public.messages where booking_id=b2; r := r || E'\n3 admin reads disputed chat: ' || n;
  select count(*) into n from public.messages where booking_id=b6; r := r || E'; other chats: ' || n || ' (expect 0)';
  select count(*) into n from public.disputes; r := r || E'; disputes visible to admin: ' || n;

  -- 4 admin decisions
  begin perform public.resolve_dispute(dsp, 'split', 'ok'); r := r || E'\n4 BAD note too short'; exception when others then r := r || E'\n4 short note rejected: ' || sqlerrm; end;
  begin perform public.resolve_dispute(dsp, 'split', 'Half the rooms were cleaned', 30000); r := r || E'\n4 BAD split refunds everything'; exception when others then r := r || E'\n4 full-price split rejected: ' || sqlerrm; end;
  perform public.resolve_dispute(dsp, 'split', 'Half the rooms were cleaned', 10000);
  perform public.resolve_dispute(dsp2, 'refund_customer', 'The work was not done, refunded in full');
  perform public.resolve_dispute((select id from public.disputes where booking_id=b4), 'release_payout', 'Provider has proof they attended');
  begin perform public.resolve_dispute(dsp, 'refund_customer', 'Second decision attempt'); r := r || E'\n4 BAD decided twice'; exception when others then r := r || E'\n4 second decision rejected: ' || sqlerrm; end;
  perform pg_temp.as_owner();
  select b.status::text||' price/commission/earning='||b.price_cents||'/'||b.commission_cents||'/'||b.earning_cents||' payout='||b.payout_status into st from public.bookings b where id=b2; r := r || E'\n4 split R100 back: ' || st || ' (expect completed 30000/2000/18000)';
  select b.status::text||' payout='||b.payout_status into st from public.bookings b where id=b3; r := r || E'\n4 refund: ' || st || ' (expect cancelled none)';
  select b.status::text||' commission/earning='||b.commission_cents||'/'||b.earning_cents into st from public.bookings b where id=b4; r := r || E'\n4 release: ' || st || ' (expect completed 3000/27000)';
  select d.status||' '||d.decision||' refund='||d.refund_cents||' payout='||d.payout_cents||' decided_by_admin='||(d.decided_by=a) into st from public.disputes d where id=dsp; r := r || E'\n4 dispute row: ' || st;
  select count(*) into n from public.notifications where kind='dispute_decided' and user_id in (c,o); r := r || E'\n4 both people told: ' || n || ' (expect 6)';
  select count(*) into n from public.booking_events where kind='dispute_decision'; r := r || E'; events logged: ' || n;

  -- 5 earnings summary; the refunded job never counts
  perform pg_temp.as_user(o);
  select 'jobs='||completed_jobs||' gross='||gross_cents||' commission='||commission_cents||' net='||net_cents into st from public.provider_earnings_summary(); r := r || E'\n5 summary: ' || st;
  perform pg_temp.as_owner();

  -- 6 payments: no gateway
  begin perform public.record_payment_event('test','e0','payment_succeeded', b6, 'ref0', 30000, 500); r := r || E'\n6 BAD event accepted with no gateway'; exception when others then r := r || E'\n6 events refused with no gateway: ' || sqlerrm; end;
  perform pg_temp.as_user(c);
  begin perform public.record_payment_event('test','e0','payment_succeeded', b6, 'ref0', 30000, 500); r := r || E'\n6 BAD customer called the payment function'; exception when others then r := r || E'\n6 customer cannot call it: ' || left(sqlerrm,45); end;
  perform pg_temp.as_owner();
  update public.platform_settings set value=1 where key='gateway_ready';
  update public.bookings set status='awaiting_payment', payment_status='pending', expires_at=now()+interval '10 minutes' where id in (b6,b7,b8,b10);
  update public.bookings set status='cancelled' where id=b9;
  res := public.record_payment_event('test','e1','payment_succeeded', b6, 'ref1', 30000, 520); r := r || E'\n6 payment ok: ' || res;
  res := public.record_payment_event('test','e1','payment_succeeded', b6, 'ref1', 30000, 520); r := r || ', same event again: ' || res;
  res := public.record_payment_event('test','e1b','payment_succeeded', b6, 'ref1', 30000, 520); r := r || ', same payment new event id: ' || res;
  select count(*)||' payment row(s), fee='||coalesce(max(processor_fee_cents),0) into st from public.payments where booking_id=b6; r := r || E'\n6 ' || st || ' (expect 1 row, fee 520)';
  select status::text||' pay='||payment_status||' payout='||payout_status into st from public.bookings where id=b6; r := r || E'; booking: ' || st || ' (expect confirmed paid held)';
  select earning_cents||'' into st from public.bookings where id=b6; r := r || E'; earning unaffected by fee: ' || st;
  res := public.record_payment_event('test','e2','payment_failed', b7, 'ref2', 30000, 0); r := r || E'\n6 failed payment: ' || res;
  select status::text||' pay='||payment_status||' payout='||payout_status into st from public.bookings where id=b7; r := r || E'; booking: ' || st || ' (expect awaiting_payment failed none, never paid)';
  res := public.record_payment_event('test','e3','payment_succeeded', b9, 'ref3', 30000, 450); r := r || E'\n6 payment for a cancelled booking: ' || res;
  select status::text||' pay='||payment_status into st from public.bookings where id=b9; r := r || E'; booking: ' || st;
  update public.bookings set expires_at = now() - interval '1 minute' where id=b8;
  res := public.record_payment_event('test','e4','payment_succeeded', b8, 'ref4', 30000, 450); r := r || E'\n6 payment after the window closed: ' || res;
  res := public.record_payment_event('test','e5','payment_succeeded', b10, 'ref5', 100, 5); r := r || E'\n6 wrong amount: ' || res;
  select status::text||' pay='||payment_status into st from public.bookings where id=b10; r := r || E'; booking: ' || st || ' (expect still awaiting_payment, not paid)';
  select count(*) into n from public.payments where status='needs_refund'; r := r || E'\n6 flagged for refund: ' || n || ' (expect 3)';

  -- 7 paid job through to payout eligibility
  update public.bookings set scheduled_date = current_date - 1 where id=b6;
  perform pg_temp.as_user(o); update public.bookings set status='awaiting_confirmation' where id=b6;
  perform pg_temp.as_user(c); update public.bookings set status='completed' where id=b6;
  perform pg_temp.as_owner();
  select status::text||' payout='||payout_status into st from public.bookings where id=b6; r := r || E'\n7 paid job confirmed: ' || st || ' (expect completed eligible)';
  -- a paid job in dispute is never released by itself
  update public.bookings set status='confirmed', payment_status='paid', payout_status='held', scheduled_date=current_date-2 where id=b7;
  perform pg_temp.as_user(o); update public.bookings set status='awaiting_confirmation' where id=b7;
  perform pg_temp.as_user(c); perform public.report_booking_issue(b7, 'other', 'The provider took extra money at the door');
  perform pg_temp.as_owner();
  update public.bookings set confirm_by = now() - interval '5 days' where id=b7;
  perform public.complete_stale_confirmations(); perform public.expire_stale_bookings();
  select status::text||' payout='||payout_status into st from public.bookings where id=b7; r := r || E'\n7 disputed paid job after sweeps: ' || st || ' (expect disputed on_hold)';
  -- cancelled paid job: payout cleared
  update public.bookings set status='confirmed', payment_status='paid', payout_status='held' where id=b9;
  update public.bookings set status='cancelled' where id=b9;
  select payout_status into st from public.bookings where id=b9; r := r || E'\n7 cancelled booking payout: ' || st || ' (expect none)';
  perform pg_temp.as_user(o); select 'net='||net_cents into st from public.provider_earnings_summary(); r := r || E'; summary now ' || st;
  perform pg_temp.as_owner();

  -- 8 reviews only follow a completed booking
  perform pg_temp.as_user(c);
  begin insert into public.reviews (user_id, booking_id, provider_slug, rating, body) values (c, b7, sl, 5, 'x'); r := r || E'\n8 BAD reviewed a disputed booking'; exception when others then r := r || E'\n8 disputed booking cannot be reviewed'; end;
  begin insert into public.reviews (user_id, booking_id, provider_slug, rating, body) values (c, b3, sl, 5, 'x'); r := r || E'\n8 BAD reviewed a refunded booking'; exception when others then r := r || E'\n8 refunded booking cannot be reviewed'; end;
  begin insert into public.reviews (user_id, booking_id, provider_slug, rating, body) values (c, b8, sl, 5, 'x'); r := r || E'\n8 BAD reviewed a booking still awaiting payment'; exception when others then r := r || E'\n8 unfinished booking cannot be reviewed'; end;
  insert into public.reviews (user_id, booking_id, provider_slug, rating, body) values (c, b1, sl, 4, 'Good job'); r := r || E'\n8 completed booking can be reviewed';
  perform pg_temp.as_owner();
  raise exception '%', r;
end $$;
