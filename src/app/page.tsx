import { SiteFooter } from '@/components/layout/site-footer';
import { SiteNav } from '@/components/layout/site-nav';
import { Hero } from '@/components/home/hero';
import { HowItWorks } from '@/components/home/how-it-works';
import { ProviderCta } from '@/components/home/provider-cta';
import { RecommendedProviders } from '@/components/home/recommended-providers';
import { ServiceTiles } from '@/components/home/service-tiles';
import { TrustAndReviews } from '@/components/home/trust-and-reviews';

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <ServiceTiles />
        <RecommendedProviders />
        <TrustAndReviews />
        <HowItWorks />
        <ProviderCta />
      </main>
      <SiteFooter />
    </>
  );
}
