-- New booking lifecycle statuses. Kept in its own migration because Postgres will not let a new
-- enum value be used in the same transaction that adds it. 'pending' stays as it is and means
-- "pending provider acceptance", so existing bookings and screens keep working.

alter type public.booking_status add value if not exists 'awaiting_payment';
alter type public.booking_status add value if not exists 'in_progress';
alter type public.booking_status add value if not exists 'awaiting_confirmation';
alter type public.booking_status add value if not exists 'declined';
alter type public.booking_status add value if not exists 'expired';
alter type public.booking_status add value if not exists 'disputed';
