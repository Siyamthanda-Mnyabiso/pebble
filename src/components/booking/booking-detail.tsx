import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { StatusPill } from '@/components/account/ui';
import { Icon } from '@/components/icons';
import { formatDay } from '@/lib/dates';
import { formatRand } from '@/lib/money';
import type { BookingStatus } from '@/lib/booking-status';

export type DetailBooking = {
  id: string;
  reference: string;
  service: string;
  scheduled_date: string;
  start_time: string;
  address: string;
  notes: string;
  price_cents: number;
  commission_cents?: number;
  earning_cents?: number;
  status: BookingStatus;
  created_at: string;
};

export type DetailEvent = {
  id: string;
  kind:
    BookingStatus | 'requested' | 'rescheduled' | 'dispute_reply' | 'dispute_decision';
  detail: string;
  created_at: string;
};

const EVENT_LABEL: Record<DetailEvent['kind'], string> = {
  requested: 'Booking requested',
  confirmed: 'Confirmed by the provider',
  completed: 'Job completed',
  cancelled: 'Booking cancelled',
  rescheduled: 'Rescheduled',
  pending: 'Booking requested',
  awaiting_payment: 'Accepted, awaiting payment',
  in_progress: 'Job started',
  awaiting_confirmation: 'Marked finished, awaiting your confirmation',
  declined: 'Request declined',
  expired: 'Request expired',
  disputed: 'A problem was reported',
  dispute_reply: 'The provider replied',
  dispute_decision: 'Pebble made a decision',
};

const STATUS_NOTE: Partial<Record<BookingStatus, string>> = {
  pending: 'Waiting for the provider to accept this booking.',
  awaiting_payment: 'Accepted. This booking is confirmed once it is paid.',
  awaiting_confirmation:
    'The provider marked this job finished. It is completed once the customer confirms it, or when the confirmation window ends, unless a problem is reported.',
  declined: 'The provider could not take this booking.',
  expired: 'This request ran out of time before it was accepted.',
};

function when(iso: string) {
  const parts = new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
  return parts;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-4 sm:flex-row sm:gap-6">
      <dt className="type-body-s text-muted w-32 shrink-0">{label}</dt>
      <dd className="type-body-s min-w-0 font-semibold">{children}</dd>
    </div>
  );
}

/** One booking, shown to either the customer or the provider. */
export function BookingDetail({
  booking,
  events,
  backHref,
  backLabel,
  who,
  actions,
}: {
  booking: DetailBooking;
  events: DetailEvent[];
  backHref: string;
  backLabel: string;
  /** The other party: the provider for a customer, the customer for a provider. */
  who: { label: string; name: string; phone?: string; href?: string; image?: string };
  actions?: ReactNode;
}) {
  return (
    <div className="max-w-[760px]">
      <Link
        href={backHref}
        className="type-body-s text-muted hover:text-ink inline-flex items-center gap-1.5 py-1 font-semibold"
      >
        <Icon name="skipBack" size={14} />
        {backLabel}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="type-h1">{booking.service}</h1>
          <p className="type-body-s text-muted mt-1">Reference {booking.reference}</p>
        </div>
        <StatusPill status={booking.status} />
      </div>

      {STATUS_NOTE[booking.status] ? (
        <p className="type-body-s bg-subtle mt-5 rounded-lg px-4 py-3">
          {STATUS_NOTE[booking.status]}
        </p>
      ) : null}

      {actions ? (
        <div className="mt-6 flex flex-col items-start gap-4">{actions}</div>
      ) : null}

      <dl className="divide-line border-line mt-6 divide-y border-y">
        <Row label={who.label}>
          <span className="flex items-center gap-3">
            {who.image ? (
              <span className="relative size-10 shrink-0 overflow-hidden rounded-full">
                <Image
                  src={who.image}
                  alt=""
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              </span>
            ) : null}
            <span>
              {who.href ? (
                <Link href={who.href} className="hover:underline">
                  {who.name}
                </Link>
              ) : (
                who.name
              )}
              {who.phone ? (
                <>
                  <br />
                  <a
                    href={`tel:${who.phone}`}
                    className="text-muted font-normal underline"
                  >
                    {who.phone}
                  </a>
                </>
              ) : null}
            </span>
          </span>
        </Row>
        <Row label="When">
          {formatDay(booking.scheduled_date, { year: true })} at{' '}
          {booking.start_time.slice(0, 5)}
        </Row>
        <Row label="Where">{booking.address}</Row>
        {booking.notes ? <Row label="Notes">{booking.notes}</Row> : null}
        <Row label="Price">
          <span className="block font-normal">
            {booking.service} · {formatRand(booking.price_cents)}
          </span>
          <span className="mt-1 block">Total · {formatRand(booking.price_cents)}</span>
          <span className="type-caption text-muted mt-1 block font-normal">
            The provider&apos;s price. Pebble adds no booking fee.
          </span>
        </Row>
        {booking.earning_cents !== undefined ? (
          <Row label="Your earnings">
            <span className="block font-normal">
              Pebble commission · {formatRand(booking.commission_cents ?? 0)}
            </span>
            <span className="mt-1 block">
              You receive · {formatRand(booking.earning_cents)}
            </span>
          </Row>
        ) : null}
      </dl>

      <section className="mt-10">
        <h2 className="type-h2">Activity</h2>
        <ol className="mt-4 flex flex-col gap-5">
          {[...events].reverse().map((event) => (
            <li key={event.id} className="flex gap-3">
              <span
                aria-hidden="true"
                className="bg-ink mt-2 size-2 shrink-0 rounded-full"
              />
              <div>
                <p className="type-body-s font-semibold">{EVENT_LABEL[event.kind]}</p>
                {event.detail ? (
                  <p className="type-body-s text-muted">{event.detail}</p>
                ) : null}
                <p className="type-caption text-muted">{when(event.created_at)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
