-- Run first. Holds the lock for one provider for 25 seconds, then rolls back.
do $$ begin
  perform pg_advisory_xact_lock(hashtextextended('pebble-slot:race-test', 0));
  perform pg_sleep(25);
  raise exception 'A held the slot lock for 25s then rolled back';
end $$;
