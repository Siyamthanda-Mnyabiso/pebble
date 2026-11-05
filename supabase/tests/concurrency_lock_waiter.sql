-- Run about 9 seconds after the holder. Same slug as the holder waits until it lets go; a different slug does not wait.
-- Change the slug below to compare: the expected wait is about 16 seconds for race-test and 0 for any other.
do $$ declare t0 timestamptz := clock_timestamp(); waited numeric; ok boolean := true;
begin
  begin perform public.check_slot_free('race-test', current_date + 5, '08:00', 60, null); exception when others then ok := false; end;
  waited := extract(epoch from clock_timestamp() - t0);
  raise exception 'B waited % seconds for the same provider (free after A rolled back: %)', round(waited, 1), ok;
end $$;
