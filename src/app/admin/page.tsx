import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { DailyChart, Pill, Stat, Stats } from '@/components/admin/parts';
import { categoryLabel } from '@/data/providers';
import { loadStats, requireAdmin } from '@/lib/admin';
import { formatDay } from '@/lib/dates';
import { formatRand } from '@/lib/money';
import { createClient } from '@/lib/supabase/server';

export default function AdminPage() {
  return (
    <>
      <PageHeading title="Dashboard" subtitle="What is happening on Pebble." />
      <Suspense fallback={<div className="bg-subtle mt-8 h-96 rounded-lg" aria-hidden />}>
        <Overview />
      </Suspense>
    </>
  );
}

function change(now: number, before: number) {
  if (before === 0) return now > 0 ? 'New this period' : undefined;
  const pct = Math.round(((now - before) / before) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}% vs previous 30 days`;
}

type Recent = {
  id: string;
  reference: string;
  service: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  scheduled_date: string;
  price_cents: number;
};

const statusTone = {
  pending: 'grey',
  confirmed: 'blue',
  completed: 'green',
  cancelled: 'red',
} as const;

async function Overview() {
  await requireAdmin('/admin');
  const supabase = await createClient();
  const [stats, { data: recent }] = await Promise.all([
    loadStats(),
    supabase
      .from('bookings')
      .select('id, reference, service, status, scheduled_date, price_cents')
      .order('created_at', { ascending: false })
      .limit(6)
      .returns<Recent[]>(),
  ]);

  const totalByCategory = stats.by_category.reduce((sum, c) => sum + c.n, 0) || 1;
  const actions = [
    {
      n: stats.providers_pending,
      label: 'providers awaiting review',
      href: '/admin/providers?status=pending_review',
    },
    {
      n: stats.pending_payouts,
      label: 'payout requests to settle',
      href: '/admin/payments',
    },
  ].filter((a) => a.n > 0);

  return (
    <>
      <Stats>
        <Stat
          label="Total bookings"
          value={stats.bookings_total}
          hint={change(stats.bookings_30d, stats.bookings_prev_30d)}
        />
        <Stat label="Active providers" value={stats.providers_active} />
        <Stat label="Customers" value={stats.customers} />
        <Stat
          label="Platform fees earned"
          value={formatRand(stats.fees_cents)}
          hint="From completed jobs"
        />
      </Stats>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="bg-page shadow-card rounded-xl p-5">
          <h2 className="type-h3">Bookings, last 30 days</h2>
          <p className="type-body-s text-muted">{stats.bookings_30d} new bookings</p>
          <div className="mt-4">
            <DailyChart points={stats.by_day} />
          </div>
        </section>

        <section className="bg-page shadow-card rounded-xl p-5">
          <h2 className="type-h3">Bookings by service</h2>
          {stats.by_category.length === 0 ? (
            <p className="type-body-s text-muted mt-3">No bookings yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {stats.by_category.map((c) => (
                <li key={c.category}>
                  <div className="type-body-s flex justify-between">
                    <span>{categoryLabel(c.category)}</span>
                    <span className="text-muted">
                      {Math.round((c.n / totalByCategory) * 100)}%
                    </span>
                  </div>
                  <div className="bg-subtle mt-1 h-2 overflow-hidden rounded-full">
                    <div
                      className="bg-ink h-full rounded-full"
                      style={{ width: `${(c.n / totalByCategory) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="bg-page shadow-card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="type-h3">Recent bookings</h2>
            <Link href="/admin/bookings" className="type-body-s font-semibold underline">
              View all
            </Link>
          </div>
          {(recent ?? []).length === 0 ? (
            <p className="type-body-s text-muted mt-3">No bookings yet.</p>
          ) : (
            <ul className="divide-line mt-2 divide-y">
              {(recent ?? []).map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="type-body-s truncate font-semibold">{b.service}</p>
                    <p className="type-caption text-muted">
                      {b.reference} · {formatDay(b.scheduled_date)} ·{' '}
                      {formatRand(b.price_cents)}
                    </p>
                  </div>
                  <Pill tone={statusTone[b.status]}>{b.status}</Pill>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-page shadow-card rounded-xl p-5">
          <h2 className="type-h3">Needs your attention</h2>
          {actions.length === 0 ? (
            <p className="type-body-s text-muted mt-3">
              Nothing waiting. You are all caught up.
            </p>
          ) : (
            <ul className="divide-line mt-2 divide-y">
              {actions.map((a) => (
                <li key={a.href}>
                  <Link
                    href={a.href}
                    className="type-body-s flex items-center justify-between py-3 hover:underline"
                  >
                    <span>
                      <span className="font-semibold">{a.n}</span> {a.label}
                    </span>
                    <span aria-hidden>→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
