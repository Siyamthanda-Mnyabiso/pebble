import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { markAllNotificationsRead } from '@/app/account/actions';
import { EmptyState, PageHeading } from '@/components/account/ui';
import { Button } from '@/components/ui/button';
import { requireUser } from '@/lib/auth';
import { formatDay } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Notifications' };

type Row = {
  id: string;
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
};

export default function NotificationsPage() {
  return (
    <>
      <PageHeading
        title="Notifications"
        subtitle="Updates about your bookings and reviews."
      />
      <Suspense
        fallback={<div className="bg-subtle mt-10 h-64 rounded-lg" aria-hidden />}
      >
        <List />
      </Suspense>
    </>
  );
}

async function List() {
  const user = await requireUser('/account/notifications');
  const supabase = await createClient();
  const { data } = await supabase
    .from('notifications')
    .select('id, title, body, href, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)
    .returns<Row[]>();
  const rows = data ?? [];

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nothing yet"
        body="When a booking is accepted, declined, completed or reviewed, you will see it here."
      />
    );
  }

  const unread = rows.some((r) => !r.read_at);
  return (
    <>
      {unread ? (
        <form action={markAllNotificationsRead} className="mt-6">
          <Button type="submit" variant="secondary" size="sm">
            Mark all as read
          </Button>
        </form>
      ) : null}
      <ul className="bg-page shadow-card divide-line mt-6 divide-y rounded-xl px-4 sm:px-6">
        {rows.map((n) => (
          <li key={n.id}>
            <Link href={n.href || '/account/bookings'} className="flex gap-4 py-5">
              <span
                aria-hidden="true"
                className={`mt-2 size-2.5 shrink-0 rounded-full ${n.read_at ? 'bg-transparent' : 'bg-ink'}`}
              />
              <span className="min-w-0">
                <span className="type-h4 block">
                  {n.title}
                  {n.read_at ? null : <span className="sr-only"> (unread)</span>}
                </span>
                <span className="type-body-s text-muted mt-0.5 block">{n.body}</span>
                <span className="type-caption text-muted mt-1 block">
                  {formatDay(n.created_at.slice(0, 10), { year: true })}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
