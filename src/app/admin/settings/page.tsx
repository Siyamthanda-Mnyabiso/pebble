import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { Empty, Pill } from '@/components/admin/parts';
import { SettingRow } from '@/components/admin/setting-row';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Settings' };

export default function Page() {
  return (
    <>
      <PageHeading
        title="Settings"
        subtitle="Commission, booking deadlines and payment status."
      />
      <Suspense fallback={<div className="bg-subtle mt-8 h-96 rounded-lg" aria-hidden />}>
        <Content />
      </Suspense>
    </>
  );
}

const ROWS = [
  {
    key: 'commission_percent',
    label: 'Provider commission',
    help: 'Taken from each provider price. Providers see it before they set prices.',
    unit: '%',
  },
  {
    key: 'urgent_response_minutes',
    label: 'Urgent response window',
    help: 'How long a provider has to answer a booking that starts within 24 hours.',
    unit: 'minutes',
  },
  {
    key: 'future_response_hours',
    label: 'Scheduled response window',
    help: 'How long a provider has to answer a booking for a later date.',
    unit: 'hours',
  },
  {
    key: 'payment_window_minutes',
    label: 'Payment window',
    help: 'How long a customer has to pay once a booking is accepted.',
    unit: 'minutes',
  },
  {
    key: 'completion_confirm_hours',
    label: 'Completion confirmation',
    help: 'How long a customer has to confirm or report a finished job.',
    unit: 'hours',
  },
  {
    key: 'max_pending_per_customer',
    label: 'Open requests per customer',
    help: 'Most bookings a customer can have waiting at once.',
    unit: 'requests',
  },
] as const;

const time = (iso: string) =>
  new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

async function Content() {
  const { user } = await requireAdmin('/admin/settings');
  void user;
  const supabase = await createClient();
  const [{ data: rows }, { data: log }, { data: admins }] = await Promise.all([
    supabase.from('platform_settings').select('key, value'),
    supabase
      .from('platform_settings_log')
      .select('id, key, old_value, new_value, changed_by, changed_at')
      .order('changed_at', { ascending: false })
      .limit(15),
    supabase.from('profiles').select('id, full_name').eq('is_admin', true),
  ]);
  const value = new Map((rows ?? []).map((r) => [r.key as string, Number(r.value)]));
  const label = new Map<string, string>(ROWS.map((r) => [r.key, r.label]));
  label.set('customer_fee_cents', 'Customer booking fee');
  label.set('payments_enabled', 'Payments');
  const who = new Map((admins ?? []).map((a) => [a.id as string, a.full_name as string]));
  const paymentsOn = value.get('payments_enabled') === 1;
  const gatewayReady = value.get('gateway_ready') === 1;

  return (
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
      <section className="bg-page shadow-card rounded-xl px-5 sm:px-6">
        <h2 className="type-h3 pt-6">Booking and payment settings</h2>
        <ul className="divide-line divide-y">
          {ROWS.slice(0, 1).map((r) => (
            <SettingRow
              key={r.key}
              settingKey={r.key}
              label={r.label}
              help={r.help}
              unit={r.unit}
              value={value.get(r.key) ?? 0}
            />
          ))}
          <SettingRow
            settingKey="customer_fee_cents"
            label="Customer booking fee"
            help="Pebble charges customers no fee. Customers pay the provider price only."
            unit=""
            value={0}
            editable={false}
          />
          {ROWS.slice(1).map((r) => (
            <SettingRow
              key={r.key}
              settingKey={r.key}
              label={r.label}
              help={r.help}
              unit={r.unit}
              value={value.get(r.key) ?? 0}
            />
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-6">
        <section className="bg-page shadow-card rounded-xl p-6">
          <h2 className="type-h3">Payment gateway</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill tone="grey">{gatewayReady ? 'Connected' : 'Not connected'}</Pill>
            <Pill tone="grey">{paymentsOn ? 'Payments on' : 'Payments off'}</Pill>
          </div>
          <p className="type-body-s text-muted mt-3">
            Customers cannot pay yet. Payments stay switched off until a gateway is
            chosen, connected, tested and approved by you. Only the database owner can
            mark the gateway ready.
          </p>
          <dl className="type-body-s mt-4 flex flex-col gap-2">
            {[
              ['Gateway', gatewayReady ? 'Connected' : 'None selected'],
              ['Payments switched on', paymentsOn ? 'Yes' : 'No'],
              ['Safety switch', paymentsOn ? 'Off' : 'On'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt className="text-muted">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="bg-page shadow-card rounded-xl p-6">
          <h2 className="type-h3">Change history</h2>
          {(log ?? []).length === 0 ? (
            <Empty>No changes yet.</Empty>
          ) : (
            <ul className="mt-4 flex flex-col gap-4">
              {(log ?? []).map((l) => (
                <li key={l.id}>
                  <p className="type-body-s font-semibold">
                    {label.get(l.key) ?? l.key}: {l.old_value ?? '-'} to{' '}
                    {Number(l.new_value)}
                  </p>
                  <p className="type-caption text-muted">
                    {who.get(l.changed_by as string) ?? 'An admin'} · {time(l.changed_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
