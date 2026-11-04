import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ExploreHeader } from '@/components/explore/explore-header';
import { FilterBar } from '@/components/explore/filter-bar';
import { ProviderCard } from '@/components/home/provider-card';
import { SiteFooter } from '@/components/layout/site-footer';
import { ButtonLink } from '@/components/ui/button';
import { getSavedSlugs } from '@/lib/auth';
import { categoryLabel, searchProviders, type ProviderFilters } from '@/data/providers';

export const metadata: Metadata = {
  title: 'Explore services',
  description: 'Find trusted, verified service providers near you.',
};

const PAGE_SIZE = 6;
const area = 'Cape Town';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toNumber(value: string | undefined) {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function parse(params: SearchParams): ProviderFilters & { limit: number } {
  const sort = first(params.sort);
  const avail = first(params.avail);
  return {
    q: first(params.q),
    category: first(params.category),
    minRating: toNumber(first(params.minRating)),
    minPrice: toNumber(first(params.min)),
    maxPrice: toNumber(first(params.max)),
    availability: avail === 'today' || avail === 'week' ? avail : undefined,
    sort:
      sort === 'rating' || sort === 'price-asc' || sort === 'price-desc'
        ? sort
        : undefined,
    limit: Math.min(toNumber(first(params.limit)) ?? PAGE_SIZE, 60),
  };
}

export default function ExplorePage({ searchParams }: PageProps<'/explore'>) {
  return (
    <>
      <Suspense fallback={<ExploreHeader area={area} />}>
        {searchParams.then((params) => (
          <ExploreHeader q={first(params.q)} area={area} />
        ))}
      </Suspense>
      <main className="mx-auto w-full max-w-[1440px] px-4 pt-6 pb-16 md:px-8 lg:px-16">
        <Suspense fallback={<ResultsSkeleton />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function Results({ searchParams }: Pick<PageProps<'/explore'>, 'searchParams'>) {
  const raw = await searchParams;
  const filters = parse(raw);
  const [{ providers, total }, saved] = await Promise.all([
    searchProviders(filters),
    getSavedSlugs(),
  ]);

  const label = filters.category ? categoryLabel(filters.category) : undefined;
  const title = label
    ? `${label} services in ${area}`
    : filters.q
      ? `Results for “${filters.q}”`
      : `Services in ${area}`;

  const more = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const v = first(value);
    if (v && key !== 'limit') more.set(key, v);
  }
  more.set('limit', String(filters.limit + PAGE_SIZE));

  return (
    <>
      <nav aria-label="Breadcrumb" className="type-body-s">
        <Link href="/explore" className="hover:text-muted">
          Services
        </Link>
      </nav>
      <h1 className="type-h1 mt-2 max-w-[640px]">{title}</h1>
      <p className="type-body-s text-muted mt-1">
        {total} {total === 1 ? 'provider' : 'providers'} available
      </p>

      <div className="mt-5">
        <Suspense>
          <FilterBar total={total} />
        </Suspense>
      </div>

      {providers.length > 0 ? (
        <ul className="mt-6 grid grid-cols-1 gap-x-5 gap-y-8 min-[1500px]:grid-cols-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {providers.map((provider) => (
            <li key={provider.slug}>
              <ProviderCard provider={provider} saved={saved.has(provider.slug)} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="bg-subtle mt-6 flex flex-col items-center rounded-lg px-6 py-20 text-center">
          <h2 className="type-h2">No providers match yet</h2>
          <p className="type-body text-muted mt-2 max-w-sm">
            Try a different search or clear your filters to see everyone nearby.
          </p>
          <ButtonLink href="/explore" className="mt-6">
            Clear filters
          </ButtonLink>
        </div>
      )}

      {providers.length > 0 ? (
        <div className="mt-10 flex flex-col items-center gap-4">
          <p className="type-body-s text-muted">
            Showing {providers.length} of {total} providers
          </p>
          {providers.length < total ? (
            <ButtonLink
              href={`/explore?${more.toString()}`}
              variant="secondary"
              scroll={false}
            >
              Show more
            </ButtonLink>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function ResultsSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="bg-subtle h-4 w-16 rounded-full" />
      <div className="bg-subtle mt-4 h-24 w-full max-w-[560px] rounded-lg" />
      <div className="mt-10 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="bg-subtle aspect-[4/3] rounded-lg" />
        ))}
      </div>
    </div>
  );
}
