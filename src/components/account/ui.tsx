import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

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

const statusStyles = {
  confirmed: 'bg-dark text-on-dark border-transparent',
  pending: 'border-line-strong text-ink',
  completed: 'border-line text-muted',
  cancelled: 'border-line text-muted',
} as const;

export function StatusPill({ status }: { status: keyof typeof statusStyles }) {
  return (
    <span
      className={cn(
        'type-caption inline-flex h-8 items-center rounded-full border px-3.5 font-semibold capitalize',
        statusStyles[status],
      )}
    >
      {status}
    </span>
  );
}
