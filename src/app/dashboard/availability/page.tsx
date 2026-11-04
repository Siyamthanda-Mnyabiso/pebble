import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { NotLinked } from '@/components/dashboard/booking-row';
import { HoursForm, TimeOffForm } from '@/components/dashboard/forms';
import { loadSchedule, requireProvider } from '@/lib/dashboard';
import { todayInSA } from '@/lib/dates';

export const metadata: Metadata = { title: 'Availability' };

export default function AvailabilityPage() {
  return (
    <>
      <PageHeading
        title="Availability"
        subtitle="Choose the days and start times customers can book."
      />
      <Suspense
        fallback={<div className="bg-subtle mt-10 h-64 rounded-lg" aria-hidden />}
      >
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const { provider } = await requireProvider('/dashboard/availability');
  if (!provider) return <NotLinked />;
  const today = todayInSA();
  const { hours, off } = await loadSchedule(provider.slug, today);
  return (
    <>
      <HoursForm hours={hours} />
      <section className="mt-12">
        <h2 className="type-h2 mb-5">Time off</h2>
        <TimeOffForm today={today} days={off} />
      </section>
    </>
  );
}
