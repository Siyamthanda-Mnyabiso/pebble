import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BookingDetail } from '@/components/booking/booking-detail';
import type { DetailBooking, DetailEvent } from '@/components/booking/booking-detail';
import { BookingActions } from '@/components/dashboard/booking-actions';
import { NotLinked, providerActions } from '@/components/dashboard/booking-row';
import { ButtonLink } from '@/components/ui/button';
import { requireProvider } from '@/lib/dashboard';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Booking' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function Page({ params }: PageProps<'/dashboard/bookings/[id]'>) {
  return (
    <Suspense fallback={<div className="bg-subtle h-96 rounded-lg" aria-hidden />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({
  params,
}: {
  params: PageProps<'/dashboard/bookings/[id]'>['params'];
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const { provider } = await requireProvider(`/dashboard/bookings/${id}`);
  if (!provider) return <NotLinked />;

  const supabase = await createClient();
  const [{ data: booking }, { data: events }] = await Promise.all([
    supabase
      .from('bookings')
      .select(
        'id, reference, user_id, service, scheduled_date, start_time, address, notes, price_cents, commission_cents, earning_cents, status, created_at',
      )
      .eq('id', id)
      .eq('provider_slug', provider.slug)
      .maybeSingle<DetailBooking & { user_id: string }>(),
    supabase
      .from('booking_events')
      .select('id, kind, detail, created_at')
      .eq('booking_id', id)
      .order('created_at', { ascending: true })
      .returns<DetailEvent[]>(),
  ]);
  if (!booking) notFound();

  const { data: customer } = await supabase
    .from('profiles')
    .select('full_name, phone')
    .eq('id', booking.user_id)
    .maybeSingle<{ full_name: string; phone: string }>();

  const { actions, hint } = providerActions({ ...booking });

  return (
    <BookingDetail
      booking={booking}
      events={events ?? []}
      backHref="/dashboard/bookings"
      backLabel="All bookings"
      who={{
        label: 'Customer',
        name: customer?.full_name || 'Customer',
        phone: customer?.phone || undefined,
      }}
      actions={
        <>
          <ButtonLink href={`/dashboard/messages/${booking.id}`} variant="secondary">
            Message customer
          </ButtonLink>
          {actions.length > 0 ? (
            <BookingActions bookingId={booking.id} actions={actions} />
          ) : null}
          {hint ? <p className="type-body-s text-muted">{hint}</p> : null}
        </>
      }
    />
  );
}
