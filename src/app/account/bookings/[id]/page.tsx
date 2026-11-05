import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
  ConfirmOrReport,
  DisputeSummary,
  type DisputeView,
} from '@/components/booking/dispute-panels';
import { BookingDetail } from '@/components/booking/booking-detail';
import type { DetailBooking, DetailEvent } from '@/components/booking/booking-detail';
import { RescheduleForm } from '@/components/booking/reschedule-form';
import { BookingActions } from '@/components/dashboard/booking-actions';
import { ButtonLink } from '@/components/ui/button';
import { getProvider, getProviderLite } from '@/data/providers';
import { requireUser } from '@/lib/auth';
import { todayInSA } from '@/lib/dates';
import { loadEvidence } from '@/lib/disputes';
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

  const [{ data: booking }, { data: events }, { data: review }, { data: disputes }] =
    await Promise.all([
      supabase
        .from('bookings')
        .select(
          'id, reference, provider_slug, service, scheduled_date, start_time, address, notes, price_cents, status, created_at, confirm_by',
        )
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle<
          DetailBooking & { provider_slug: string; confirm_by: string | null }
        >(),
      supabase
        .from('booking_events')
        .select('id, kind, detail, created_at')
        .eq('booking_id', id)
        .order('created_at', { ascending: true })
        .returns<DetailEvent[]>(),
      supabase.from('reviews').select('id').eq('booking_id', id).maybeSingle(),
      supabase
        .from('disputes')
        .select(
          'id, reason, details, provider_reply, status, decision, decision_note, refund_cents, created_at',
        )
        .eq('booking_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .returns<DisputeView[]>(),
    ]);
  if (!booking) notFound();

  const evidence = disputes?.[0]
    ? await loadEvidence(supabase, disputes[0].id, user.id)
    : [];
  const today = todayInSA();
  const active =
    booking.status === 'pending' ||
    booking.status === 'awaiting_payment' ||
    booking.status === 'confirmed';
  const upcoming = active && booking.scheduled_date >= today;
  const provider = upcoming
    ? await getProvider(booking.provider_slug)
    : await getProviderLite(booking.provider_slug);

  const actions = (
    <>
      <ButtonLink href={`/account/messages/${booking.id}`} variant="secondary">
        Message {provider?.name ?? 'provider'}
      </ButtonLink>
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
          actions={[{ label: 'Cancel booking', move: 'cancel', danger: true }]}
        />
      ) : null}
      {booking.status === 'awaiting_confirmation' ? (
        <ConfirmOrReport bookingId={booking.id} confirmBy={booking.confirm_by} />
      ) : null}
      {disputes?.[0] ? (
        <DisputeSummary dispute={disputes[0]} viewer="customer" evidence={evidence} />
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
