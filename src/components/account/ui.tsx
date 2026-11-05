import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { type BookingStatus, STATUS_LABEL } from '@/lib/booking-status';

export function PageHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header>
      <h1 className="type-h1">{title}</h1>
      <p className="type-body-l text-muted mt-2">{subtitle}</p>
    </header>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="bg-subtle mt-6 flex flex-col items-center rounded-lg px-6 py-14 text-center">
      <p className="type-h3">{title}</p>
      <p className="type-body-s text-muted mt-2 max-w-sm">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

const statusStyles: Record<BookingStatus, string> = {
  confirmed: 'bg-dark text-on-dark border-transparent',
  in_progress: 'bg-dark text-on-dark border-transparent',
  pending: 'border-line-strong text-ink',
  awaiting_payment: 'border-line-strong text-ink',
  awaiting_confirmation: 'border-line-strong text-ink',
  disputed: 'border-line-strong text-ink',
  completed: 'border-line text-muted',
  cancelled: 'border-line text-muted',
  declined: 'border-line text-muted',
  expired: 'border-line text-muted',
};

export function StatusPill({ status }: { status: BookingStatus }) {
  return (
    <span
      className={cn(
        'type-caption inline-flex h-8 items-center rounded-full border px-3.5 font-semibold capitalize',
        statusStyles[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
