import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { BookingList, NotLinked } from '@/components/dashboard/booking-row';
import { loadBookings, requireProvider } from '@/lib/dashboard';

export const metadata: Metadata = { title: 'Bookings' };

export default function BookingsPage() {
  return (
    <>
      <PageHeading
        title="Bookings"
        subtitle="Accept requests, complete jobs and keep track of your week."
      />
      <Suspense
        fallback={<div className="bg-subtle mt-10 h-64 rounded-lg" aria-hidden />}
      >
        <Bookings />
      </Suspense>
    </>
  );
}

async function Bookings() {
  const { provider } = await requireProvider('/dashboard/bookings');
  if (!provider) return <NotLinked />;

  const { bookings, customers } = await loadBookings(provider.slug);
  const requests = bookings.filter((b) => b.status === 'pending');
  const upcoming = bookings.filter((b) => b.status === 'confirmed');
  const past = bookings
    .filter((b) => ['completed', 'cancelled', 'declined', 'expired'].includes(b.status))
    .reverse();

  return (
    <>
      <BookingList
        title="Requests"
        empty="No pending requests."
        bookings={requests}
        customers={customers}
      />
      <BookingList
        title="Confirmed"
        empty="No confirmed jobs."
        bookings={upcoming}
        customers={customers}
      />
      <BookingList
        title="Past"
        empty="No completed or cancelled jobs yet."
        bookings={past}
        customers={customers}
      />
    </>
  );
}
