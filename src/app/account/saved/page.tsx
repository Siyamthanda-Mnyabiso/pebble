import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EmptyState, PageHeading } from '@/components/account/ui';
import { ProviderCard } from '@/components/home/provider-card';
import { ButtonLink } from '@/components/ui/button';
import { getProviderLite } from '@/data/providers';
import { getSavedSlugs, requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Saved providers' };

export default function SavedPage() {
  return (
    <>
      <PageHeading
        title="Saved providers"
        subtitle="Providers you have hearted, ready when you are."
      />
      <Suspense fallback={<div className="bg-subtle mt-8 h-64 rounded-lg" aria-hidden />}>
        <Saved />
      </Suspense>
    </>
  );
}

async function Saved() {
  await requireUser('/account/saved');
  const slugs = [...(await getSavedSlugs())];
  const providers = (
    await Promise.all(slugs.map((slug) => getProviderLite(slug)))
  ).filter((p) => p !== undefined);

  if (providers.length === 0) {
    return (
      <EmptyState
        title="Nothing saved yet"
        body="Tap the heart on any provider to keep them here."
        action={<ButtonLink href="/explore">Explore providers</ButtonLink>}
      />
    );
  }

  return (
    <ul className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {providers.map((provider) => (
        <li key={provider.slug}>
          <ProviderCard provider={provider} saved />
        </li>
      ))}
    </ul>
  );
}
