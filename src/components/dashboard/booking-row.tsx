import Link from 'next/link';
import { StatusPill } from '@/components/account/ui';
import { Icon } from '@/components/icons';
import type { Customer, DashboardBooking } from '@/lib/dashboard';
import { formatDay, todayInSA } from '@/lib/dates';

function formatDeadline(iso: string) {
  return new Intl.DateTimeFormat('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Johannesburg',
  }).format(new Date(iso));
}
import { formatRand } from '@/lib/money';
import { BookingActions } from './booking-actions';
import { CreateListingForm } from './forms';

type ActionList = Parameters<typeof BookingActions>[0]['actions'];

/** The buttons a provider gets for a booking, and a hint when one is not available yet. */
export function providerActions(booking: DashboardBooking) {
  const today = todayInSA();
  const actions: ActionList = [];
  let hint = '';

  if (booking.status === 'pending') {
    actions.push({ label: 'Accept', move: 'accept' });
    actions.push({ label: 'Decline', move: 'decline', danger: true });
  } else if (booking.status === 'awaiting_payment') {
    hint = 'Waiting for the customer to pay';
    actions.push({ label: 'Cancel', move: 'cancel', danger: true });
  } else if (booking.status === 'confirmed' || booking.status === 'in_progress') {
    if (booking.scheduled_date <= today) {
      actions.push({ label: 'Mark job done', move: 'done' });
    } else {
      hint = `You can mark it done on ${formatDay(booking.scheduled_date)}`;
    }
    if (booking.status === 'confirmed') {
      actions.push({ label: 'Cancel', move: 'cancel', danger: true });
    }
  } else if (booking.status === 'awaiting_confirmation') {
    hint = 'Waiting for the customer to confirm';
  } else if (booking.status === 'disputed') {
    hint = 'The customer reported a problem. Open the booking to reply.';
  }
  return { actions, hint };
}

export function BookingRow({
  booking,
  customer,
}: {
  booking: DashboardBooking;
  customer?: Customer;
}) {
  const { actions, hint } = providerActions(booking);

  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-3 py-5">
      <div className="min-w-0 flex-1 basis-56">
        <p className="type-h4">
          <Link href={`/dashboard/bookings/${booking.id}`} className="hover:underline">
            {booking.service}
          </Link>
        </p>
        <p className="type-body-s mt-0.5 font-semibold">
          {customer?.full_name || 'Customer'}
          {customer?.phone ? (
            <>
              {' · '}
              <a href={`tel:${customer.phone}`} className="underline">
                {customer.phone}
              </a>
            </>
          ) : null}
        </p>
        <p className="type-body-s text-muted mt-0.5">
          {formatDay(booking.scheduled_date)} · {booking.start_time.slice(0, 5)} ·{' '}
          {formatRand(booking.price_cents)}
        </p>
        <p className="type-body-s text-muted mt-0.5 flex items-center gap-1.5">
          <Icon name="pin" size={14} />
          <span>{booking.address}</span>
        </p>
        {booking.notes ? (
          <p className="type-body-s text-muted mt-1">Note: {booking.notes}</p>
        ) : null}
        <p className="type-caption text-muted mt-1">
          Ref {booking.reference}
          {booking.status === 'pending' && booking.expires_at ? (
            <> · Reply by {formatDeadline(booking.expires_at)}</>
          ) : null}
        </p>
        {booking.status !== 'pending' || booking.price_cents ? (
          <p className="type-caption text-muted mt-0.5">
            You receive {formatRand(booking.earning_cents)} after{' '}
            {formatRand(booking.commission_cents)} commission
          </p>
        ) : null}
      </div>
      <div className="flex flex-col items-end gap-3">
        <StatusPill status={booking.status} />
        {actions.length > 0 ? (
          <BookingActions bookingId={booking.id} actions={actions} />
        ) : null}
        {hint ? <p className="type-caption text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

export function BookingList({
  title,
  empty,
  bookings,
  customers,
}: {
  title: string;
  empty: string;
  bookings: DashboardBooking[];
  customers: Map<string, Customer>;
}) {
  return (
    <section className="mt-10">
      <h2 className="type-h2">{title}</h2>
      {bookings.length > 0 ? (
        <ul className="bg-page shadow-card divide-line mt-5 divide-y rounded-xl px-4 sm:px-6">
          {bookings.map((booking) => (
            <li key={booking.id}>
              <BookingRow booking={booking} customer={customers.get(booking.user_id)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="type-body-s text-muted mt-4">{empty}</p>
      )}
    </section>
  );
}

export function NotLinked() {
  return (
    <div className="bg-subtle mt-8 rounded-lg px-6 py-12 text-center">
      <p className="type-h3">Set up your listing</p>
      <p className="type-body-s text-muted mx-auto mt-2 max-w-md">
        Tell us about your business to get a public profile. You can add services, prices
        and your hours next.
      </p>
      <CreateListingForm />
    </div>
  );
}
