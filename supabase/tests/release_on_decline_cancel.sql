do $$
declare o uuid := '00000000-0000-0000-0000-0000000000a1'; r text := ''; b uuid; d date := current_date + 8; n int;
begin
  -- c1 books 08:00, provider declines, c2 books the same slot
  perform set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-000000000101','role','authenticated')::text, true); set local role authenticated;
  insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents) values ('RL1','00000000-0000-0000-0000-000000000101','concurrency-test','Clean',d,'08:00','1 Long Street, Cape Town',1) returning id into b;
  reset role; perform set_config('request.jwt.claims','',true);
  begin
    perform set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-000000000102','role','authenticated')::text, true); set local role authenticated;
    insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents) values ('RL2','00000000-0000-0000-0000-000000000102','concurrency-test','Clean',d,'08:00','1 Long Street, Cape Town',1);
    r := r || E'\nBAD second customer got the held slot';
  exception when others then r := r || E'\nheld slot refused while the first request is open: ' || sqlerrm; end;
  reset role; perform set_config('request.jwt.claims','',true);
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role','authenticated')::text, true); set local role authenticated;
  update public.bookings set status='declined' where id=b;
  reset role; perform set_config('request.jwt.claims','',true);
  perform set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-000000000102','role','authenticated')::text, true); set local role authenticated;
  insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents) values ('RL2','00000000-0000-0000-0000-000000000102','concurrency-test','Clean',d,'08:00','1 Long Street, Cape Town',1);
  r := r || E'\nslot free again after the provider declined';
  update public.bookings set status='cancelled' where reference='RL2';
  reset role; perform set_config('request.jwt.claims','',true);
  perform set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-000000000103','role','authenticated')::text, true); set local role authenticated;
  insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents) values ('RL3','00000000-0000-0000-0000-000000000103','concurrency-test','Clean',d,'08:00','1 Long Street, Cape Town',1);
  r := r || E'\nslot free again after the customer cancelled';
  reset role; perform set_config('request.jwt.claims','',true);
  raise exception '%', r;
end $$;
