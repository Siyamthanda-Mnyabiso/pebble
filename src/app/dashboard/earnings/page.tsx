import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EmptyState, PageHeading } from '@/components/account/ui';
import { NotLinked } from '@/components/dashboard/booking-row';
import { PayoutButton } from '@/components/dashboard/payout-button';
import {
  loadBookings,
  loadPlatformTerms,
  requireProvider,
  type PayoutStatus,
} from '@/lib/dashboard';
import { formatDay, formatMonthYear } from '@/lib/dates';
import { formatRand } from '@/lib/money';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Earnings' };

export default function EarningsPage() {
  return (
    <>
      <PageHeading
        title="Earnings"
        subtitle="What customers paid, Pebble commission and what you take home."
      />
      <Suspense
        fallback={<div className="bg-subtle mt-10 h-64 rounded-lg" aria-hidden />}
      >
        <Earnings />
      </Suspense>
    </>
  );
}

const PAYOUT_LABEL: Record<PayoutStatus, string> = {
  none: 'Pending',
  held: 'Pending',
  eligible: 'Pending',
  on_hold: 'On hold',
  processing: 'Processing',
  paid: 'Paid',
  failed: 'Failed',
};

async function Earnings() {
  const { provider } = await requireProvider('/dashboard/earnings');
  if (!provider) return <NotLinked />;

  const { bookings, customers } = await loadBookings(provider.slug);
  const completed = bookings.filter((b) => b.status === 'completed').reverse();
  const terms = await loadPlatformTerms();

  const supabase = await createClient();
  const [{ data: balanceData }, { data: payoutRows }, { data: summaryRows }] =
    await Promise.all([
      supabase.rpc('payout_balance'),
      supabase
        .from('payouts')
        .select('id, amount_cents, status, note, requested_at')
        .eq('provider_slug', provider.slug)
        .order('requested_at', { ascending: false })
        .limit(20),
      supabase.rpc('provider_earnings_summary'),
    ]);
  const sum = (summaryRows?.[0] ?? {}) as Record<string, number>;
  const balance = Number(balanceData ?? 0);
  const payouts = payoutRows ?? [];
  const open = payouts.some((p) => p.status === 'requested');
  const awaiting = bookings
    .filter((b) => b.status === 'awaiting_confirmation')
    .reduce((total, b) => total + b.earning_cents, 0);

  const byMonth = new Map<string, number>();
  for (const b of completed) {
    const key = b.scheduled_date.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + b.earning_cents);
  }

  return (
    <>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Gross revenue', value: formatRand(Number(sum.gross_cents ?? 0)) },
          {
            label: `Pebble commission (${terms.commissionPercent}%)`,
            value:
              Number(sum.commission_cents ?? 0) > 0
                ? `-${formatRand(Number(sum.commission_cents))}`
                : formatRand(0),
          },
          { label: 'Net earnings', value: formatRand(Number(sum.net_cents ?? 0)) },
          { label: 'Completed jobs', value: String(sum.completed_jobs ?? 0) },
          { label: 'Pending payout', value: formatRand(Number(sum.pending_cents ?? 0)) },
          { label: 'Processing', value: formatRand(Number(sum.processing_cents ?? 0)) },
          { label: 'Paid out', value: formatRand(Number(sum.paid_cents ?? 0)) },
          { label: 'Failed', value: formatRand(Number(sum.failed_cents ?? 0)) },
        ].map((stat) => (
          <li key={stat.label} className="bg-page shadow-card rounded-xl p-5">
            <p className="type-stat">{stat.value}</p>
            <p className="type-body-s text-muted mt-1">{stat.label}</p>
          </li>
        ))}
      </ul>
      <p className="type-caption text-muted mt-4">
        Gross is what customers paid. Pebble takes {terms.commissionPercent}% of each
        price and you keep the rest. Payment processing fees are Pebble&apos;s cost and
        never reduce your earnings.
        {awaiting > 0
          ? ` ${formatRand(awaiting)} more is waiting for customers to confirm their jobs.`
          : ''}
      </p>

      <section className="mt-10">
        <h2 className="type-h2">Payouts</h2>
        <div className="bg-page shadow-card mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl p-6">
          <div>
            <p className="type-stat">{formatRand(balance)}</p>
            <p className="type-body-s text-muted mt-1">
              {open
                ? 'Available after your open request is settled'
                : balance >= 10000
                  ? 'Available to pay out'
                  : 'Available (minimum payout is R100)'}
            </p>
          </div>
          <PayoutButton disabled={open || balance < 10000} />
        </div>
        <p className="type-caption text-muted mt-3">
          The Pebble team settles payouts by hand while we are in preview. We will contact
          you for your bank details, and you will get a notification when it is paid.
        </p>
        {payouts.length > 0 ? (
          <ul className="bg-page shadow-card divide-line mt-4 divide-y rounded-xl px-4 sm:px-6">
            {payouts.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 py-4"
              >
                <span>
                  <span className="type-body-s block font-semibold">
                    {formatRand(p.amount_cents)}
                  </span>
                  <span className="type-caption text-muted">
                    Requested {formatDay(p.requested_at.slice(0, 10), { year: true })}
                    {p.note ? ` · ${p.note}` : ''}
                  </span>
                </span>
                <span className="type-caption border-line-strong rounded-full border px-3 py-1 font-semibold capitalize">
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {completed.length === 0 ? (
        <EmptyState
          title="No earnings yet"
          body="Once a customer confirms a finished job, it shows up here."
        />
      ) : (
        <>
          <section className="mt-10">
            <h2 className="type-h2">Net earnings by month</h2>
            <ul className="bg-page shadow-card divide-line mt-5 divide-y rounded-xl px-4 sm:px-6">
              {[...byMonth.entries()]
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([key, cents]) => (
                  <li key={key} className="flex justify-between py-4">
                    <span className="type-body-s font-semibold">
                      {formatMonthYear(`${key}-01`)}
                    </span>
                    <span className="type-body-s">{formatRand(cents)}</span>
                  </li>
                ))}
            </ul>
          </section>
          <section className="mt-10">
            <h2 className="type-h2">Completed bookings</h2>
            <ul className="bg-page shadow-card divide-line mt-5 divide-y rounded-xl px-4 sm:px-6">
              {completed.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <span>
                    <span className="type-body-s block font-semibold">{b.service}</span>
                    <span className="type-caption text-muted">
                      {customers.get(b.user_id)?.full_name || 'Customer'} ·{' '}
                      {formatDay(b.scheduled_date)}
                    </span>
                  </span>
                  <span className="type-caption text-muted text-right">
                    Customer paid {formatRand(b.price_cents)}
                    <br />
                    Commission -{formatRand(b.commission_cents)}
                    <br />
                    <span className="text-ink font-semibold">
                      You earn {formatRand(b.earning_cents)}
                    </span>
                  </span>
                  <span className="type-caption border-line-strong rounded-full border px-3 py-1 font-semibold">
                    {PAYOUT_LABEL[b.payout_status]}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
