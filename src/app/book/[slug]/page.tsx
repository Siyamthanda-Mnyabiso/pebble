import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BookingFlow } from '@/components/booking/booking-flow';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteNav } from '@/components/layout/site-nav';
import { getProvider, listProviderSlugs } from '@/data/providers';

export const metadata: Metadata = { title: 'Book a service' };

export async function generateStaticParams() {
  const slugs = await listProviderSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default function BookPage({ params }: PageProps<'/book/[slug]'>) {
  return (
    <>
      <SiteNav />
      <Suspense fallback={<div className="min-h-[600px]" aria-hidden="true" />}>
        <Booking params={params} />
      </Suspense>
      <SiteFooter />
    </>
  );
}

async function Booking({ params }: Pick<PageProps<'/book/[slug]'>, 'params'>) {
  const { slug } = await params;
  const provider = await getProvider(slug);
  if (!provider) notFound();

  return (
    <Suspense>
      <BookingFlow provider={provider} />
    </Suspense>
  );
}
