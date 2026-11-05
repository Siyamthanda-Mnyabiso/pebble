-- A provider can only request a payout for jobs the customer has actually paid for. Until a payment
-- gateway is live no booking is paid, so the available balance is R0 and no payout can be requested.
-- request_payout() already uses this function, so it is refused too (the minimum payout is R100).

create or replace function public.payout_balance()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select sum(b.earning_cents) from public.bookings b
    where b.provider_slug = public.current_provider_slug()
      and b.status = 'completed'
      and b.payment_status = 'paid'
  ), 0)::integer - coalesce((
    select sum(p.amount_cents) from public.payouts p
    where p.provider_slug = public.current_provider_slug() and p.status in ('requested', 'paid')
  ), 0)::integer
$$;
