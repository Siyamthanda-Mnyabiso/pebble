import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { NotLinked } from '@/components/dashboard/booking-row';
import { PhotoManager } from '@/components/dashboard/photo-manager';
import { requireProvider } from '@/lib/dashboard';

export const metadata: Metadata = { title: 'Photos' };

export default function PhotosPage() {
  return (
    <>
      <PageHeading
        title="Photos"
        subtitle="Show customers your work. The main photo appears on search results."
      />
      <Suspense
        fallback={<div className="bg-subtle mt-10 h-64 rounded-lg" aria-hidden />}
      >
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const { provider } = await requireProvider('/dashboard/photos');
  if (!provider) return <NotLinked />;
  return (
    <PhotoManager slug={provider.slug} image={provider.image} work={provider.work} />
  );
}
