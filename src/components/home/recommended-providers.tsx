import { recommendedProviders } from '@/data/home';
import { ProviderCard } from './provider-card';
import { SectionHeader } from './section-header';

export function RecommendedProviders() {
  return (
    <section
      aria-labelledby="recommended"
      className="mx-auto max-w-[1440px] px-4 pt-6 pb-16 md:px-8 lg:px-16 lg:pb-20"
    >
      <SectionHeader
        id="recommended"
        title="Recommended near you"
        subtitle="Verified providers with great reviews this month."
        linkLabel="See all providers"
        href="/explore"
      />
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {recommendedProviders.map((provider) => (
          <li key={provider.slug}>
            <ProviderCard provider={provider} />
          </li>
        ))}
      </ul>
    </section>
  );
}
