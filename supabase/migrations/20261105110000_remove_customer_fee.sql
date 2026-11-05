-- Pebble no longer charges customers a booking fee. Customers pay the provider's price; Pebble earns
-- a commission taken from the provider's side. Existing records are brought in line: no fee was ever
-- collected, because payments are not live yet.

update public.platform_settings
   set value = 0, note = 'Customer booking fee in cents. Pebble charges customers no fee', updated_at = now()
 where key = 'customer_fee_cents';

alter table public.bookings alter column fee_cents set default 0;
update public.bookings set fee_cents = 0 where fee_cents <> 0;

-- A customer-facing charge needs explicit approval, so the fee can only ever be set to R0 here.
-- Changing that means changing this rule on purpose, in a migration.

-- Every settings change is recorded: who, what, and the old and new value.
create table public.platform_settings_log (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  old_value numeric,
  new_value numeric not null,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index platform_settings_log_idx on public.platform_settings_log (changed_at desc);

alter table public.platform_settings_log enable row level security;

create policy "Admins read the settings log"
  on public.platform_settings_log for select to authenticated
  using ((select public.is_admin()));

grant select on public.platform_settings_log to authenticated;

create or replace function public.admin_set_setting(p_key text, p_value numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare lo numeric; hi numeric; old numeric;
begin
  if not (select public.is_admin()) then raise exception 'Not allowed'; end if;
  case p_key
    when 'commission_percent' then lo := 0; hi := 50;
    when 'customer_fee_cents' then lo := 0; hi := 0;
    when 'urgent_within_hours' then lo := 1; hi := 72;
    when 'urgent_response_minutes' then lo := 5; hi := 240;
    when 'future_response_hours' then lo := 1; hi := 168;
    when 'payment_window_minutes' then lo := 5; hi := 120;
    when 'completion_confirm_hours' then lo := 1; hi := 168;
    when 'max_pending_per_customer' then lo := 1; hi := 50;
    when 'payments_enabled' then lo := 0; hi := 1;
    else raise exception 'Unknown setting';
  end case;
  if p_value < lo or p_value > hi then
    if p_key = 'customer_fee_cents' then
      raise exception 'Pebble does not charge customers a booking fee';
    end if;
    raise exception 'That value must be between % and %', lo, hi;
  end if;
  if p_key = 'payments_enabled' and p_value = 1 and public.setting('gateway_ready') is distinct from 1 then
    raise exception 'Payments cannot be switched on until a payment gateway is connected';
  end if;
  select value into old from public.platform_settings where key = p_key;
  if old is not distinct from p_value then return; end if;
  update public.platform_settings
     set value = p_value, updated_at = now(), updated_by = (select auth.uid())
   where key = p_key;
  insert into public.platform_settings_log (key, old_value, new_value, changed_by)
  values (p_key, old, p_value, (select auth.uid()));
end;
$$;
