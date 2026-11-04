import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteNav } from '@/components/layout/site-nav';
import { ProviderProfile } from '@/components/provider/provider-profile';
import { getSavedSlugs } from '@/lib/auth';
import { getProvider, listProviderSlugs } from '@/data/providers';

export async function generateStaticParams() {
  const slugs = await listProviderSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<'/providers/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const provider = await getProvider(slug);
  if (!provider) return {};
  return {
    title: provider.name,
    description: `${provider.tagline}. ${provider.rating.toFixed(1)} stars from ${provider.reviewCount} reviews.`,
  };
}

export default function ProviderPage({ params }: PageProps<'/providers/[slug]'>) {
  return (
    <>
      <SiteNav />
      <Suspense fallback={<div className="min-h-[900px]" aria-hidden="true" />}>
        <Profile params={params} />
      </Suspense>
      <SiteFooter />
    </>
  );
}

async function Profile({ params }: Pick<PageProps<'/providers/[slug]'>, 'params'>) {
  const { slug } = await params;
  const provider = await getProvider(slug);
  if (!provider) notFound();

  const saved = await getSavedSlugs();
  return <ProviderProfile provider={provider} saved={saved.has(provider.slug)} />;
}
