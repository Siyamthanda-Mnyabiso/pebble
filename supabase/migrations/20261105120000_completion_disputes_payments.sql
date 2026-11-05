-- Job completion, disputes, payout states and the payment record skeleton.
-- No payment gateway is connected: nothing here moves money. It records decisions and states so a
-- gateway can be plugged in later without changing the rules.

-- 1. Completion: the provider marks the job done, the customer confirms or reports a problem ------

alter table public.bookings
  add column confirm_by timestamptz,
  add column completed_at timestamptz;

alter table public.bookings drop constraint bookings_payout_status_check;
alter table public.bookings add constraint bookings_payout_status_check
  check (payout_status in ('none', 'held', 'eligible', 'on_hold', 'processing', 'paid', 'failed'));

alter table public.booking_events drop constraint booking_events_kind_check;
alter table public.booking_events add constraint booking_events_kind_check check (kind in (
  'requested', 'confirmed', 'completed', 'cancelled', 'rescheduled',
  'awaiting_payment', 'in_progress', 'awaiting_confirmation', 'declined', 'expired', 'disputed',
  'dispute_reply', 'dispute_decision'));

-- A provider can only mark a job finished. It becomes completed when the customer confirms, or on its own
-- after the confirmation window. A disputed job is only closed by an admin.
create or replace function public.enforce_booking_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  is_provider boolean;
  today date := (now() at time zone 'Africa/Johannesburg')::date;
  payments_on boolean := public.setting('payments_enabled') = 1;
begin
  if new.status = old.status then
    return new;
  end if;
  if uid is null then
    return new;
  end if;
  if current_setting('pebble.rescheduling', true) = 'on' and new.status = 'pending' then
    return new;
  end if;

  if old.status in ('pending', 'awaiting_payment') and old.expires_at is not null
     and old.expires_at < now() and new.status <> 'cancelled' then
    raise exception 'This request has expired';
  end if;

  is_provider := old.provider_slug = public.current_provider_slug();

  if is_provider then
    if old.status = 'pending' then
      if new.status in ('cancelled', 'declined') then return new; end if;
      if new.status = 'confirmed' and not payments_on then return new; end if;
      if new.status = 'awaiting_payment' and payments_on then return new; end if;
    elsif old.status = 'awaiting_payment' and new.status = 'cancelled' then
      return new;
    elsif old.status = 'confirmed' then
      if new.status = 'cancelled' then return new; end if;
      if new.status in ('in_progress', 'awaiting_confirmation') then
        if old.scheduled_date > today then
          raise exception 'A booking can only be started or completed on or after its date';
        end if;
        return new;
      end if;
    elsif old.status = 'in_progress' and new.status = 'awaiting_confirmation' then
      return new;
    end if;
  elsif uid = old.user_id then
    if old.status in ('pending', 'awaiting_payment', 'confirmed') and new.status = 'cancelled' then
      return new;
    end if;
    if old.status = 'awaiting_confirmation' and new.status in ('completed', 'disputed') then
      return new;
    end if;
  elsif (select public.is_admin()) then
    if old.status = 'disputed' and new.status in ('completed', 'cancelled') then
      return new;
    end if;
  end if;

  raise exception 'That status change is not allowed';
end;
$$;

-- Money state follows the booking state. A disputed job's payout is held and never released by itself.
create function public.sync_booking_money_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = old.status then return new; end if;

  if new.status = 'awaiting_confirmation' then
    new.confirm_by := now() + make_interval(hours => public.setting('completion_confirm_hours')::integer);
  elsif new.status = 'disputed' then
    new.confirm_by := null;
    if new.payout_status in ('none', 'held', 'eligible') then new.payout_status := 'on_hold'; end if;
  elsif new.status = 'completed' then
    new.completed_at := now();
    new.confirm_by := null;
    if old.status = 'awaiting_confirmation' and new.payment_status = 'paid'
       and new.payout_status in ('none', 'held') then
      new.payout_status := 'eligible';
    end if;
  elsif new.status in ('cancelled', 'declined', 'expired') then
    new.confirm_by := null;
    if new.payout_status in ('held', 'eligible', 'on_hold') then new.payout_status := 'none'; end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.sync_booking_money_state() from public, anon, authenticated;

create trigger bookings_sync_money_state
  before update of status on public.bookings
  for each row execute function public.sync_booking_money_state();

-- Customers who do nothing are treated as satisfied, but never when a problem has been reported.
create function public.complete_stale_confirmations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  with done as (
    update public.bookings
       set status = 'completed'
     where status = 'awaiting_confirmation' and confirm_by < now()
     returning 1
  )
  select count(*) into n from done;
  return n;
end;
$$;

revoke execute on function public.complete_stale_confirmations() from public, anon, authenticated;

do $$
begin
  perform cron.schedule('complete-stale-confirmations', '*/5 * * * *', 'select public.complete_stale_confirmations()');
exception when others then
  raise notice 'Scheduled completion not set up: %', sqlerrm;
end $$;

-- 2. Disputes ------------------------------------------------------------------------------------

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  opened_by uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('not_done', 'poor_quality', 'no_show', 'other')),
  details text not null check (char_length(btrim(details)) between 10 and 2000),
  provider_reply text check (provider_reply is null or char_length(btrim(provider_reply)) between 1 and 2000),
  provider_replied_at timestamptz,
  status text not null default 'open' check (status in ('open', 'resolved')),
  decision text check (decision in ('release_payout', 'refund_customer', 'split')),
  decision_note text,
  refund_cents integer check (refund_cents is null or refund_cents >= 0),
  payout_cents integer check (payout_cents is null or payout_cents >= 0),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (status = 'open' or (decision is not null and decided_at is not null))
);

create unique index disputes_one_open on public.disputes (booking_id) where status = 'open';
create index disputes_status_idx on public.disputes (status, created_at desc);

alter table public.disputes enable row level security;

create policy "Parties and admins read disputes"
  on public.disputes for select to authenticated
  using (
    (select public.is_admin())
    or opened_by = (select auth.uid())
    or exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.provider_slug = (select public.current_provider_slug())
    )
  );

grant select on public.disputes to authenticated;

-- An admin looking into a dispute can read that booking's conversation, and nothing else.
create policy "Admins read messages of disputed bookings"
  on public.messages for select to authenticated
  using (
    (select public.is_admin())
    and exists (select 1 from public.disputes d where d.booking_id = messages.booking_id)
  );

create function public.report_booking_issue(p_booking uuid, p_reason text, p_details text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  b public.bookings;
  d uuid;
begin
  select * into b from public.bookings where id = p_booking;
  if not found or b.user_id is distinct from uid then raise exception 'Booking not found'; end if;
  if b.status <> 'awaiting_confirmation' then
    raise exception 'A problem can only be reported once the provider has marked the job finished';
  end if;
  update public.bookings set status = 'disputed' where id = p_booking;
  insert into public.disputes (booking_id, opened_by, reason, details)
  values (p_booking, uid, p_reason, p_details)
  returning id into d;
  return d;
end;
$$;

revoke execute on function public.report_booking_issue(uuid, text, text) from public, anon;
grant execute on function public.report_booking_issue(uuid, text, text) to authenticated;

create function public.reply_to_dispute(p_dispute uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.disputes;
  b public.bookings;
begin
  select * into d from public.disputes where id = p_dispute;
  if not found then raise exception 'Dispute not found'; end if;
  select * into b from public.bookings where id = d.booking_id;
  if b.provider_slug is distinct from public.current_provider_slug() then raise exception 'Dispute not found'; end if;
  if d.status <> 'open' then raise exception 'This dispute has been decided'; end if;
  if d.provider_reply is not null then raise exception 'You have already replied'; end if;
  update public.disputes set provider_reply = p_text, provider_replied_at = now() where id = p_dispute;
  insert into public.booking_events (booking_id, kind, detail) values (d.booking_id, 'dispute_reply', 'The provider replied');
  perform public.notify_admins('Provider replied to a dispute', b.service || ' on ' || to_char(b.scheduled_date, 'Dy DD Mon'), '/admin/disputes');
end;
$$;

revoke execute on function public.reply_to_dispute(uuid, text) from public, anon;
grant execute on function public.reply_to_dispute(uuid, text) to authenticated;

-- Admin decision. It records the outcome and moves the booking to its final state. Moving the money is a
-- separate step that waits for a verified payment gateway: refunds and payouts are authorised here, not sent.
create function public.resolve_dispute(p_dispute uuid, p_decision text, p_note text, p_refund_cents integer default 0)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  d public.disputes;
  b public.bookings;
  refund integer := 0;
  payout integer;
  what text;
  owner uuid;
  msg text;
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  if p_decision not in ('release_payout', 'refund_customer', 'split') then raise exception 'Unknown decision'; end if;
  if p_note is null or char_length(btrim(p_note)) < 5 then raise exception 'Add a short note both people will see'; end if;
  select * into d from public.disputes where id = p_dispute for update;
  if not found then raise exception 'Dispute not found'; end if;
  if d.status <> 'open' then raise exception 'This dispute has already been decided'; end if;
  select * into b from public.bookings where id = d.booking_id for update;
  if b.status <> 'disputed' then raise exception 'The booking is not in dispute'; end if;

  if p_decision = 'refund_customer' then
    refund := b.price_cents;
    payout := 0;
  elsif p_decision = 'release_payout' then
    payout := b.earning_cents;
  else
    if p_refund_cents < 1 or p_refund_cents >= b.price_cents then
      raise exception 'A split refund must be more than R0 and less than the full price';
    end if;
    refund := p_refund_cents;
    payout := round(b.earning_cents::numeric * (b.price_cents - refund) / b.price_cents)::integer;
  end if;

  update public.disputes
     set status = 'resolved', decision = p_decision, decision_note = btrim(p_note),
         refund_cents = refund, payout_cents = payout, decided_by = uid, decided_at = now()
   where id = p_dispute;

  if p_decision = 'refund_customer' then
    update public.bookings set status = 'cancelled', payout_status = 'none' where id = b.id;
  else
    update public.bookings
       set status = 'completed',
           earning_cents = payout,
           commission_cents = (price_cents - refund) - payout,
           payout_status = case when payment_status = 'paid' then 'eligible' else 'none' end
     where id = b.id;
  end if;

  what := b.service || ' on ' || to_char(b.scheduled_date, 'Dy DD Mon');
  msg := case p_decision
    when 'refund_customer' then 'Decision: refund. '
    when 'release_payout' then 'Decision: the provider is paid. '
    else 'Decision: part refund. ' end || btrim(p_note);
  insert into public.booking_events (booking_id, kind, detail) values (b.id, 'dispute_decision', msg);
  perform public.notify(b.user_id, 'dispute_decided', 'We looked into your report', what || '. ' || msg, '/account/bookings/' || b.id);
  select id into owner from public.profiles where provider_slug = b.provider_slug;
  if owner is not null then
    perform public.notify(owner, 'dispute_decided', 'A dispute was decided', what || '. ' || msg, '/dashboard/bookings/' || b.id);
  end if;
end;
$$;

revoke execute on function public.resolve_dispute(uuid, text, text, integer) from public, anon;
grant execute on function public.resolve_dispute(uuid, text, text, integer) to authenticated;

-- 3. Payment records (no gateway yet) ---------------------------------------------------------

-- What a gateway reported. The processing fee is Pebble's own cost, kept apart from provider earnings.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  gateway text not null,
  gateway_ref text not null,
  amount_cents integer not null check (amount_cents > 0),
  processor_fee_cents integer not null default 0 check (processor_fee_cents >= 0),
  status text not null check (status in ('succeeded', 'failed', 'needs_refund', 'refunded')),
  created_at timestamptz not null default now(),
  unique (gateway, gateway_ref)
);

create index payments_booking_idx on public.payments (booking_id);

-- Every webhook event is stored once. Receiving the same event again changes nothing.
create table public.payment_events (
  gateway text not null,
  event_id text not null,
  kind text not null,
  booking_id uuid,
  received_at timestamptz not null default now(),
  primary key (gateway, event_id)
);

alter table public.payments enable row level security;
alter table public.payment_events enable row level security;

create policy "Admins read payments"
  on public.payments for select to authenticated
  using ((select public.is_admin()));

grant select on public.payments to authenticated;

-- Only a server holding the service role, after verifying the gateway's signature, may call this.
create function public.record_payment_event(
  p_gateway text, p_event_id text, p_kind text, p_booking uuid, p_ref text, p_amount integer, p_fee integer default 0
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.bookings;
  fresh integer;
begin
  if public.setting('gateway_ready') is distinct from 1 then
    raise exception 'No payment gateway is connected';
  end if;
  if p_kind not in ('payment_succeeded', 'payment_failed') then raise exception 'Unknown event'; end if;

  insert into public.payment_events (gateway, event_id, kind, booking_id)
  values (p_gateway, p_event_id, p_kind, p_booking)
  on conflict do nothing;
  get diagnostics fresh = row_count;
  if fresh = 0 then return 'duplicate'; end if;

  select * into b from public.bookings where id = p_booking for update;
  if not found then raise exception 'Booking not found'; end if;

  if p_kind = 'payment_failed' then
    if b.status = 'awaiting_payment' then
      update public.bookings set payment_status = 'failed' where id = b.id and payment_status <> 'paid';
    end if;
    return 'failed';
  end if;

  -- The same payment reported again under a new event id: nothing more to do.
  if exists (select 1 from public.payments where gateway = p_gateway and gateway_ref = p_ref) then
    return 'already_recorded';
  end if;

  if p_amount <> b.price_cents then
    insert into public.payments (booking_id, gateway, gateway_ref, amount_cents, processor_fee_cents, status)
    values (b.id, p_gateway, p_ref, p_amount, p_fee, 'needs_refund') on conflict do nothing;
    return 'amount_mismatch';
  end if;

  -- Paid too late or after cancelling: keep the record, do not confirm, flag for a refund.
  if b.status <> 'awaiting_payment' or (b.expires_at is not null and b.expires_at < now()) then
    insert into public.payments (booking_id, gateway, gateway_ref, amount_cents, processor_fee_cents, status)
    values (b.id, p_gateway, p_ref, p_amount, p_fee, 'needs_refund') on conflict do nothing;
    return 'needs_refund';
  end if;

  insert into public.payments (booking_id, gateway, gateway_ref, amount_cents, processor_fee_cents, status)
  values (b.id, p_gateway, p_ref, p_amount, p_fee, 'succeeded') on conflict do nothing;
  update public.bookings
     set status = 'confirmed', payment_status = 'paid', payout_status = 'held', expires_at = null
   where id = b.id;
  return 'confirmed';
end;
$$;

revoke execute on function public.record_payment_event(text, text, text, uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.record_payment_event(text, text, text, uuid, text, integer, integer) to service_role;

-- 4. What a provider has earned, split by payout state ----------------------------------------------

create function public.provider_earnings_summary()
returns table (
  completed_jobs integer, gross_cents bigint, commission_cents bigint, net_cents bigint,
  pending_cents bigint, processing_cents bigint, paid_cents bigint, failed_cents bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*)::integer,
    coalesce(sum(b.commission_cents + b.earning_cents), 0),
    coalesce(sum(b.commission_cents), 0),
    coalesce(sum(b.earning_cents), 0),
    coalesce(sum(b.earning_cents) filter (where b.payout_status in ('none', 'held', 'eligible', 'on_hold')), 0),
    coalesce(sum(b.earning_cents) filter (where b.payout_status = 'processing'), 0),
    coalesce(sum(b.earning_cents) filter (where b.payout_status = 'paid'), 0),
    coalesce(sum(b.earning_cents) filter (where b.payout_status = 'failed'), 0)
  from public.bookings b
  where b.provider_slug = public.current_provider_slug() and b.status = 'completed'
$$;

revoke execute on function public.provider_earnings_summary() from public, anon;
grant execute on function public.provider_earnings_summary() to authenticated;
