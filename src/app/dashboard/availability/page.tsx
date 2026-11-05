import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { NotLinked } from '@/components/dashboard/booking-row';
import { HoursForm, PreferencesForm, TimeOffForm } from '@/components/dashboard/forms';
import { loadPreferences, loadSchedule, requireProvider } from '@/lib/dashboard';
import { todayInSA } from '@/lib/dates';

export const metadata: Metadata = { title: 'Availability' };

export default function AvailabilityPage() {
  return (
    <>
      <PageHeading
        title="Availability"
        subtitle="Set when you work, the gap between jobs and how many bookings you take a day."
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
  const [{ hours, off }, prefs] = await Promise.all([
    loadSchedule(provider.slug, today),
    loadPreferences(provider.slug),
  ]);
  return (
    <>
      <HoursForm hours={hours} />
      <section className="mt-12">
        <h2 className="type-h2">Booking preferences</h2>
        <PreferencesForm bufferMinutes={prefs.bufferMinutes} maxDaily={prefs.maxDaily} />
      </section>
      <section className="mt-12">
        <h2 className="type-h2 mb-5">Time off</h2>
        <TimeOffForm today={today} days={off} />
      </section>
    </>
  );
}
