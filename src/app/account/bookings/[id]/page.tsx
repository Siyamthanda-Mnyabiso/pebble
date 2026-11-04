import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BookingDetail } from '@/components/booking/booking-detail';
import type { DetailBooking, DetailEvent } from '@/components/booking/booking-detail';
import { RescheduleForm } from '@/components/booking/reschedule-form';
import { BookingActions } from '@/components/dashboard/booking-actions';
import { ButtonLink } from '@/components/ui/button';
import { getProvider, getProviderLite } from '@/data/providers';
import { requireUser } from '@/lib/auth';
import { todayInSA } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Booking' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function Page({ params }: PageProps<'/account/bookings/[id]'>) {
  return (
    <Suspense fallback={<div className="bg-subtle h-96 rounded-lg" aria-hidden />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({
  params,
}: {
  params: PageProps<'/account/bookings/[id]'>['params'];
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const user = await requireUser(`/account/bookings/${id}`);
  const supabase = await createClient();

  const [{ data: booking }, { data: events }, { data: review }] = await Promise.all([
    supabase
      .from('bookings')
      .select(
        'id, reference, provider_slug, service, scheduled_date, start_time, address, notes, price_cents, fee_cents, status, created_at',
      )
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle<DetailBooking & { provider_slug: string }>(),
    supabase
      .from('booking_events')
      .select('id, kind, detail, created_at')
      .eq('booking_id', id)
      .order('created_at', { ascending: true })
      .returns<DetailEvent[]>(),
    supabase.from('reviews').select('id').eq('booking_id', id).maybeSingle(),
  ]);
  if (!booking) notFound();

  const today = todayInSA();
  const active = booking.status === 'pending' || booking.status === 'confirmed';
  const upcoming = active && booking.scheduled_date >= today;
  const provider = upcoming
    ? await getProvider(booking.provider_slug)
    : await getProviderLite(booking.provider_slug);

  const actions = (
    <>
      {upcoming ? (
        provider && 'availability' in provider ? (
          <RescheduleForm
            bookingId={booking.id}
            confirmed={booking.status === 'confirmed'}
            days={provider.availability.map((d) => ({ iso: d.iso, times: d.times }))}
          />
        ) : null
      ) : null}
      {upcoming ? (
        <BookingActions
          bookingId={booking.id}
          actions={[{ label: 'Cancel booking', status: 'cancelled', danger: true }]}
        />
      ) : null}
      {booking.status === 'completed' && !review ? (
        <ButtonLink href="/account/reviews">Leave a review</ButtonLink>
      ) : null}
      {!active && provider ? (
        <ButtonLink href={`/providers/${booking.provider_slug}`} variant="secondary">
          Book again
        </ButtonLink>
      ) : null}
    </>
  );

  return (
    <BookingDetail
      booking={booking}
      events={events ?? []}
      backHref="/account/bookings"
      backLabel="Your bookings"
      who={{
        label: 'Provider',
        name: provider?.name ?? 'Provider',
        image: provider?.image,
        href: provider ? `/providers/${booking.provider_slug}` : undefined,
      }}
      actions={actions}
    />
  );
}
