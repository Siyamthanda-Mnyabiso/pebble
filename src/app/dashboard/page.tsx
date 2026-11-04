import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { BookingList, NotLinked } from '@/components/dashboard/booking-row';
import { loadBookings, requireProvider } from '@/lib/dashboard';
import { todayInSA } from '@/lib/dates';
import { formatRand } from '@/lib/money';
import { createClient } from '@/lib/supabase/server';
import { STATUS_META, type VerificationStatus } from '@/lib/verification';
import { StatusBadge } from '@/components/verification/status';

export const metadata: Metadata = { title: 'Provider dashboard' };

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="bg-subtle h-64 rounded-lg" aria-hidden />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const { profile, provider } = await requireProvider('/dashboard');
  const first = profile.full_name.split(' ')[0];

  if (!provider) {
    return (
      <>
        <PageHeading
          title={`Welcome${first ? `, ${first}` : ''}`}
          subtitle="Your provider account is ready."
        />
        <NotLinked />
      </>
    );
  }

  const { bookings, customers } = await loadBookings(provider.slug);
  const { data: ver } = await (
    await createClient()
  )
    .from('provider_verification')
    .select('status')
    .eq('provider_slug', provider.slug)
    .maybeSingle<{ status: VerificationStatus }>();
  const vStatus = ver?.status ?? 'draft';
  const today = todayInSA();
  const requests = bookings.filter((b) => b.status === 'pending');
  const upcoming = bookings.filter(
    (b) => b.status === 'confirmed' && b.scheduled_date >= today,
  );
  const completed = bookings.filter((b) => b.status === 'completed');
  const earned = completed.reduce((sum, b) => sum + b.price_cents, 0);

  const stats = [
    {
      label: 'New requests',
      value: String(requests.length),
      href: '/dashboard/bookings',
    },
    {
      label: 'Upcoming jobs',
      value: String(upcoming.length),
      href: '/dashboard/bookings',
    },
    {
      label: 'Completed jobs',
      value: String(completed.length),
      href: '/dashboard/bookings',
    },
    { label: 'Earned', value: formatRand(earned), href: '/dashboard/earnings' },
  ];

  return (
    <>
      <PageHeading
        title={`Welcome back${first ? `, ${first}` : ''}`}
        subtitle={`Here is how ${provider.name} is doing.`}
      />
      {vStatus !== 'approved' ? (
        <Link
          href="/dashboard/verification"
          className="bg-subtle hover:bg-line mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl px-5 py-4"
        >
          <span>
            <span className="type-body-s block font-semibold">
              {STATUS_META[vStatus].headline}
            </span>
            <span className="type-body-s text-muted block">
              {STATUS_META[vStatus].message}
            </span>
          </span>
          <StatusBadge status={vStatus} />
        </Link>
      ) : null}
      <ul className="mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <li key={stat.label}>
            <Link
              href={stat.href}
              className="bg-page shadow-card hover:bg-subtle block rounded-xl p-5 transition-colors"
            >
              <p className="type-stat">{stat.value}</p>
              <p className="type-body-s text-muted mt-1">{stat.label}</p>
            </Link>
          </li>
        ))}
      </ul>
      <BookingList
        title="New requests"
        empty="No new requests. They will show up here when customers book you."
        bookings={requests.slice(0, 5)}
        customers={customers}
      />
      <BookingList
        title="Next up"
        empty="Nothing confirmed yet."
        bookings={upcoming.slice(0, 5)}
        customers={customers}
      />
    </>
  );
}
