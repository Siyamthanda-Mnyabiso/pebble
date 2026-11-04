import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteNav } from '@/components/layout/site-nav';
import { ProviderProfile } from '@/components/provider/provider-profile';
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

export default async function ProviderPage({ params }: PageProps<'/providers/[slug]'>) {
  const { slug } = await params;
  const provider = await getProvider(slug);
  if (!provider) notFound();

  return (
    <>
      <SiteNav />
      <ProviderProfile provider={provider} />
      <SiteFooter />
    </>
  );
}
