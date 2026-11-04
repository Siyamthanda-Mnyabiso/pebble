import { Suspense } from 'react';
import { listFeaturedProviders } from '@/data/providers';
import { ProviderCard } from './provider-card';
import { SectionHeader } from './section-header';

async function Featured() {
  const providers = await listFeaturedProviders();
  return (
    <ul className="mt-5 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
      {providers.map((provider) => (
        <li key={provider.slug}>
          <ProviderCard provider={provider} />
        </li>
      ))}
    </ul>
  );
}

export function RecommendedProviders() {
  return (
    <section
      aria-labelledby="recommended"
      className="mx-auto max-w-[1440px] px-4 pt-4 pb-10 md:px-8 lg:px-16 lg:pb-14"
    >
      <SectionHeader
        id="recommended"
        title="Recommended near you"
        subtitle="Verified providers with great reviews this month."
        linkLabel="See all providers"
        href="/explore"
      />
      <Suspense fallback={<div className="bg-subtle mt-6 h-64 rounded-lg" aria-hidden />}>
        <Featured />
      </Suspense>
    </section>
  );
}
