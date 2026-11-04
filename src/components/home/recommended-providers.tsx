import { Suspense } from 'react';
import { listFeaturedProviders } from '@/data/providers';
import { getSavedSlugs } from '@/lib/auth';
import { getCity } from '@/lib/city';
import { ProviderCard } from './provider-card';
import { SectionHeader } from './section-header';

async function Featured() {
  const city = await getCity();
  const [providers, saved] = await Promise.all([
    listFeaturedProviders(city),
    getSavedSlugs(),
  ]);
  return providers.length === 0 ? (
    <p className="type-body text-muted mt-5">
      We have no providers in {city} yet. Pick another city above to see who is available.
    </p>
  ) : (
    <ul className="mt-5 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
      {providers.map((provider) => (
        <li key={provider.slug}>
          <ProviderCard provider={provider} saved={saved.has(provider.slug)} />
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
