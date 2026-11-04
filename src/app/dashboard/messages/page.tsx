import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { NotLinked } from '@/components/dashboard/booking-row';
import { Inbox } from '@/components/messages/inbox';
import { requireProvider } from '@/lib/dashboard';
import { loadThreads } from '@/lib/messages';

export const metadata: Metadata = { title: 'Messages' };

export default function Page() {
  return (
    <>
      <PageHeading
        title="Messages"
        subtitle="Chat with customers about their bookings."
      />
      <Suspense fallback={<div className="bg-subtle mt-8 h-48 rounded-lg" aria-hidden />}>
        <List />
      </Suspense>
    </>
  );
}

async function List() {
  const { user, provider } = await requireProvider('/dashboard/messages');
  if (!provider) return <NotLinked />;
  const threads = await loadThreads(user.id, 'provider');
  return (
    <Inbox
      threads={threads}
      base="/dashboard/messages"
      empty="When a customer writes to you about a booking, it will show up here."
    />
  );
}
