import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ThreadView } from '@/components/messages/thread-view';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Conversation' };

export default function Page({ params }: PageProps<'/account/messages/[id]'>) {
  return (
    <Suspense fallback={<div className="bg-subtle h-96 rounded-lg" aria-hidden />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({
  params,
}: {
  params: PageProps<'/account/messages/[id]'>['params'];
}) {
  const { id } = await params;
  const user = await requireUser(`/account/messages/${id}`);
  return <ThreadView id={id} userId={user.id} side="customer" />;
}
