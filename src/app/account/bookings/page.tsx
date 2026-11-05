import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { EmptyState, PageHeading, StatusPill } from '@/components/account/ui';
import { BookingActions } from '@/components/dashboard/booking-actions';
import { Icon } from '@/components/icons';
import { ButtonLink } from '@/components/ui/button';
import { getProviderLite } from '@/data/providers';
import { requireUser } from '@/lib/auth';
import { formatDay, todayInSA } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import type { BookingStatus } from '@/lib/booking-status';

export const metadata: Metadata = { title: 'Your bookings' };

type BookingRow = {
  id: string;
  provider_slug: string;
  service: string;
  scheduled_date: string;
  start_time: string;
  address: string;
  status: BookingStatus;
};

export default function BookingsPage() {
  return (
    <>
      <PageHeading
        title="Your bookings"
        subtitle="Everything you have booked on Pebble, in one place."
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
  const user = await requireUser('/account/bookings');
  const supabase = await createClient();

  const [{ data: bookings }, { data: reviewed }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, provider_slug, service, scheduled_date, start_time, address, status')
      .eq('user_id', user.id)
      .order('scheduled_date', { ascending: true })
      .returns<BookingRow[]>(),
    supabase.from('reviews').select('booking_id').eq('user_id', user.id),
  ]);

  const reviewedIds = new Set((reviewed ?? []).map((r) => r.booking_id));
  const today = todayInSA();
  const all = bookings ?? [];
  const upcoming = all.filter(
    (b) =>
      (b.status === 'pending' || b.status === 'confirmed') && b.scheduled_date >= today,
  );
  const previous = all.filter((b) => !upcoming.includes(b)).reverse();

  if (all.length === 0) {
    return (
      <EmptyState
        title="No bookings yet"
        body="When you book a provider, it will show up here."
        action={<ButtonLink href="/explore">Find a provider</ButtonLink>}
      />
    );
  }

  return (
    <>
      <Section title="Upcoming" empty="Nothing coming up.">
        {upcoming.map((b) => (
          <Row key={b.id} booking={b} />
        ))}
      </Section>
      <Section title="Previous" empty="No past bookings yet.">
        {previous.map((b) => (
          <Row key={b.id} booking={b} reviewed={reviewedIds.has(b.id)} past />
        ))}
      </Section>
    </>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <section className="mt-10">
      <h2 className="type-h2">{title}</h2>
      {children.length > 0 ? (
        <ul className="bg-page shadow-card divide-line mt-5 divide-y rounded-xl px-4 sm:px-6">
          {children.map((child, i) => (
            <li key={i}>{child}</li>
          ))}
        </ul>
      ) : (
        <p className="type-body-s text-muted mt-4">{empty}</p>
      )}
    </section>
  );
}

async function Row({
  booking,
  reviewed = false,
  past = false,
}: {
  booking: BookingRow;
  reviewed?: boolean;
  past?: boolean;
}) {
  const provider = await getProviderLite(booking.provider_slug);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 py-5">
      <div className="relative size-[70px] shrink-0 overflow-hidden rounded-md">
        <Image
          src={provider?.image ?? '/images/cleaning.jpg'}
          alt=""
          fill
          sizes="70px"
          className="object-cover"
        />
      </div>
      <div className="min-w-0 flex-1 basis-48">
        <p className="type-h4">
          <Link href={`/account/bookings/${booking.id}`} className="hover:underline">
            {booking.service}
          </Link>
        </p>
        <p className="type-body-s text-muted mt-0.5">
          {provider ? `${provider.name} · ` : ''}
          {formatDay(booking.scheduled_date)} · {booking.start_time.slice(0, 5)}
        </p>
        <p className="type-body-s text-muted mt-0.5 flex items-center gap-1.5">
          <Icon name="pin" size={14} />
          <span className="truncate">{booking.address}</span>
        </p>
      </div>
      <div className="flex items-center gap-3">
        <StatusPill status={booking.status} />
        {!past && (booking.status === 'pending' || booking.status === 'confirmed') ? (
          <BookingActions
            bookingId={booking.id}
            actions={[{ label: 'Cancel', status: 'cancelled', danger: true }]}
          />
        ) : null}
        {past && booking.status === 'completed' ? (
          reviewed ? null : (
            <ButtonLink href="/account/reviews" variant="secondary" size="sm">
              Leave review
            </ButtonLink>
          )
        ) : null}
        {past && provider ? (
          <ButtonLink href={`/book/${provider.slug}`} variant="secondary" size="sm">
            Book again
          </ButtonLink>
        ) : null}
      </div>
    </div>
  );
}
