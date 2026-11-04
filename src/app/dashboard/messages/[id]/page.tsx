import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NotLinked } from '@/components/dashboard/booking-row';
import { ThreadView } from '@/components/messages/thread-view';
import { requireProvider } from '@/lib/dashboard';

export const metadata: Metadata = { title: 'Conversation' };

export default function Page({ params }: PageProps<'/dashboard/messages/[id]'>) {
  return (
    <Suspense fallback={<div className="bg-subtle h-96 rounded-lg" aria-hidden />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({
  params,
}: {
  params: PageProps<'/dashboard/messages/[id]'>['params'];
}) {
  const { id } = await params;
  const { user, provider } = await requireProvider(`/dashboard/messages/${id}`);
  if (!provider) return <NotLinked />;
  return <ThreadView id={id} userId={user.id} side="provider" />;
}
