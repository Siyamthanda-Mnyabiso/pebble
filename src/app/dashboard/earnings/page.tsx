import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EmptyState, PageHeading } from '@/components/account/ui';
import { NotLinked } from '@/components/dashboard/booking-row';
import { loadBookings, requireProvider } from '@/lib/dashboard';
import { formatDay, formatMonthYear, todayInSA } from '@/lib/dates';
import { formatRand } from '@/lib/money';

export const metadata: Metadata = { title: 'Earnings' };

export default function EarningsPage() {
  return (
    <>
      <PageHeading
        title="Earnings"
        subtitle="What you have earned from completed jobs."
      />
      <Suspense
        fallback={<div className="bg-subtle mt-10 h-64 rounded-lg" aria-hidden />}
      >
        <Earnings />
      </Suspense>
    </>
  );
}

async function Earnings() {
  const { provider } = await requireProvider('/dashboard/earnings');
  if (!provider) return <NotLinked />;

  const { bookings, customers } = await loadBookings(provider.slug);
  const completed = bookings.filter((b) => b.status === 'completed').reverse();
  const total = completed.reduce((sum, b) => sum + b.price_cents, 0);
  const thisMonth = todayInSA().slice(0, 7);
  const month = completed
    .filter((b) => b.scheduled_date.startsWith(thisMonth))
    .reduce((sum, b) => sum + b.price_cents, 0);
  const owed = bookings
    .filter((b) => b.status === 'confirmed')
    .reduce((sum, b) => sum + b.price_cents, 0);

  const byMonth = new Map<string, number>();
  for (const b of completed) {
    const key = b.scheduled_date.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + b.price_cents);
  }

  return (
    <>
      <ul className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'All time', value: formatRand(total) },
          { label: 'This month', value: formatRand(month) },
          { label: 'Confirmed, not done yet', value: formatRand(owed) },
        ].map((stat) => (
          <li key={stat.label} className="bg-page shadow-card rounded-xl p-5">
            <p className="type-stat">{stat.value}</p>
            <p className="type-body-s text-muted mt-1">{stat.label}</p>
          </li>
        ))}
      </ul>
      <p className="type-caption text-muted mt-4">
        Amounts are job prices before any Pebble fees. Payouts are not switched on yet.
      </p>

      {completed.length === 0 ? (
        <EmptyState
          title="No earnings yet"
          body="Mark a confirmed job complete and it will show up here."
        />
      ) : (
        <>
          <section className="mt-10">
            <h2 className="type-h2">By month</h2>
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
            <h2 className="type-h2">Completed jobs</h2>
            <ul className="bg-page shadow-card divide-line mt-5 divide-y rounded-xl px-4 sm:px-6">
              {completed.map((b) => (
                <li key={b.id} className="flex flex-wrap justify-between gap-2 py-4">
                  <span>
                    <span className="type-body-s block font-semibold">{b.service}</span>
                    <span className="type-caption text-muted">
                      {customers.get(b.user_id)?.full_name || 'Customer'} ·{' '}
                      {formatDay(b.scheduled_date)}
                    </span>
                  </span>
                  <span className="type-body-s">{formatRand(b.price_cents)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
