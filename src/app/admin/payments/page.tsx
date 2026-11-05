import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { Cell, Empty, Pill, Stat, Stats, Table } from '@/components/admin/parts';
import { RowAction } from '@/components/admin/row-action';
import { loadStats, requireAdmin } from '@/lib/admin';
import { formatRand } from '@/lib/money';
import { createClient } from '@/lib/supabase/server';
import { resolvePayout } from '../actions';

export const metadata: Metadata = { title: 'Payments' };

type Payout = {
  id: string;
  provider_slug: string;
  amount_cents: number;
  status: 'requested' | 'paid' | 'rejected';
  requested_at: string;
  resolved_at: string | null;
};

const tone = { requested: 'blue', paid: 'green', rejected: 'red' } as const;
const label = { requested: 'Requested', paid: 'Paid', rejected: 'Rejected' } as const;

export default function Page() {
  return (
    <>
      <PageHeading
        title="Payments"
        subtitle="Pebble commission and provider payout requests."
      />
      <Suspense fallback={<div className="bg-subtle mt-8 h-96 rounded-lg" aria-hidden />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await requireAdmin('/admin/payments');
  const supabase = await createClient();
  const [stats, { data }, { data: providers }] = await Promise.all([
    loadStats(),
    supabase
      .from('payouts')
      .select('id, provider_slug, amount_cents, status, requested_at, resolved_at')
      .order('requested_at', { ascending: false })
      .limit(100)
      .returns<Payout[]>(),
    supabase.from('providers').select('slug, name'),
  ]);
  const name = new Map(
    (providers ?? []).map((p) => [p.slug as string, p.name as string]),
  );
  const rows = data ?? [];
  const date = (iso: string) =>
    new Intl.DateTimeFormat('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));

  return (
    <>
      <Stats>
        <Stat label="Completed job volume" value={formatRand(stats.volume_cents)} />
        <Stat label="Pebble commission" value={formatRand(stats.fees_cents)} />
        <Stat
          label="Payouts waiting"
          value={formatRand(stats.pending_payout_cents)}
          hint={`${stats.pending_payouts} open`}
        />
        <Stat label="Paid out" value={formatRand(stats.paid_payout_cents)} />
      </Stats>
      <p className="type-body-s text-muted mt-4 max-w-[640px]">
        Pebble does not move money yet. Pay the provider yourself, then press Mark paid so
        their balance and notifications stay correct.
      </p>

      {rows.length === 0 ? (
        <Empty>No payout requests yet.</Empty>
      ) : (
        <Table head={['Provider', 'Requested', 'Amount', 'Status', '']}>
          {rows.map((p) => (
            <tr key={p.id}>
              <Cell className="font-semibold">
                {name.get(p.provider_slug) ?? p.provider_slug}
              </Cell>
              <Cell>{date(p.requested_at)}</Cell>
              <Cell>{formatRand(p.amount_cents)}</Cell>
              <Cell>
                <Pill tone={tone[p.status]}>{label[p.status]}</Pill>
              </Cell>
              <Cell>
                {p.status === 'requested' ? (
                  <span className="flex flex-wrap gap-2">
                    <RowAction
                      label="Mark paid"
                      confirm
                      action={resolvePayout.bind(null, p.id, 'paid')}
                    />
                    <RowAction
                      label="Reject"
                      variant="secondary"
                      confirm
                      action={resolvePayout.bind(null, p.id, 'rejected')}
                    />
                  </span>
                ) : p.resolved_at ? (
                  <span className="text-muted">{date(p.resolved_at)}</span>
                ) : null}
              </Cell>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
