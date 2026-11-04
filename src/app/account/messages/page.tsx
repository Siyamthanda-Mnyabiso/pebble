import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { Inbox } from '@/components/messages/inbox';
import { requireUser } from '@/lib/auth';
import { loadThreads } from '@/lib/messages';

export const metadata: Metadata = { title: 'Messages' };

export default function Page() {
  return (
    <>
      <PageHeading
        title="Messages"
        subtitle="Chat with your providers about a booking."
      />
      <Suspense fallback={<div className="bg-subtle mt-8 h-48 rounded-lg" aria-hidden />}>
        <List />
      </Suspense>
    </>
  );
}

async function List() {
  const user = await requireUser('/account/messages');
  const threads = await loadThreads(user.id, 'customer');
  return (
    <Inbox
      threads={threads}
      base="/account/messages"
      empty="Open one of your bookings and choose Message to start a conversation."
    />
  );
}
