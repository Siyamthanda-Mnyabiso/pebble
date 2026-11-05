import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ExploreHeader } from '@/components/explore/explore-header';
import { CategoryBar } from '@/components/explore/category-bar';
import { FilterBar } from '@/components/explore/filter-bar';
import { ProviderCard } from '@/components/home/provider-card';
import { SiteFooter } from '@/components/layout/site-footer';
import { ButtonLink } from '@/components/ui/button';
import { getSavedSlugs } from '@/lib/auth';
import { listCategories, resolveCategory } from '@/data/categories';
import { formatRand } from '@/lib/money';
import {
  listProviderCities,
  searchProviders,
  type ProviderFilters,
} from '@/data/providers';
import { getCity } from '@/lib/city';

export const metadata: Metadata = {
  title: 'Explore services',
  description: 'Find trusted, verified service providers near you.',
};

const PAGE_SIZE = 6;

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
    service: first(params.service),
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
      <Suspense fallback={<ExploreHeader area="Choose city" />}>
        <Header searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<div className="border-line h-[74px] border-b" aria-hidden />}>
        <Categories searchParams={searchParams} />
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

async function Header({ searchParams }: Pick<PageProps<'/explore'>, 'searchParams'>) {
  const params = await searchParams;
  const [area, cities] = await Promise.all([
    getCity(first(params.city)),
    listProviderCities(),
  ]);
  return (
    <ExploreHeader q={first(params.q)} area={area} active={cities.map((c) => c.city)} />
  );
}

async function Categories({ searchParams }: Pick<PageProps<'/explore'>, 'searchParams'>) {
  const params = await searchParams;
  const category = await resolveCategory(first(params.category));
  return <CategoryBar current={category?.slug} q={first(params.q)} />;
}

async function Results({ searchParams }: Pick<PageProps<'/explore'>, 'searchParams'>) {
  const raw = await searchParams;
  const area = await getCity(first(raw.city));
  const filters = { ...parse(raw), city: area };
  const [{ providers, total }, saved, cities] = await Promise.all([
    searchProviders(filters),
    getSavedSlugs(),
    listProviderCities(),
  ]);
  const elsewhere = cities.filter((c) => c.city !== area);

  const resolved = await resolveCategory(filters.category);
  const category = resolved
    ? (await listCategories()).find((c) => c.slug === resolved.slug)
    : undefined;
  const service = category?.services.find((x) => x.id === filters.service);
  const label = resolved?.label;
  const title = label
    ? `${label} services in ${area}`
    : filters.q
      ? `Results for “${filters.q}”`
      : `Services in ${area}`;

  const more = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const v = first(value);
    if (v && key !== 'limit' && key !== 'city') more.set(key, v);
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

      {category && category.services.length > 0 ? (
        <ServiceChips category={category} current={service?.id} raw={raw} />
      ) : null}

      <div className="mt-5">
        <Suspense>
          <FilterBar total={total} />
        </Suspense>
      </div>

      {service && providers.length > 0 ? (
        <section
          aria-label={`${service.name} prices`}
          className="bg-page shadow-card mt-6 rounded-xl p-5 sm:p-6"
        >
          <h2 className="type-h3">
            {service.name} prices in {area}
          </h2>
          <p className="type-caption text-muted">Prices are set by each provider.</p>
          <ul className="divide-line mt-3 divide-y">
            {providers.map((p) => (
              <li
                key={p.slug}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3"
              >
                <span className="min-w-0 flex-1 basis-40">
                  <Link
                    href={`/providers/${p.slug}`}
                    className="type-body-s font-semibold hover:underline"
                  >
                    {p.name}
                  </Link>
                  <span className="type-caption text-muted block">
                    {p.verified ? 'Verified' : 'Not yet verified'}
                    {p.availableToday ? ' · Available today' : ''}
                  </span>
                </span>
                <span className="type-body-s text-muted">
                  {p.reviewCount > 0
                    ? `${p.rating.toFixed(1)} (${p.reviewCount})`
                    : 'No reviews yet'}
                </span>
                <span className="type-body-s w-20 font-semibold">
                  {formatRand(p.fromPrice * 100)}
                </span>
                <ButtonLink href={`/book/${p.slug}`} size="sm">
                  Book
                </ButtonLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
          <h2 className="type-h2">No providers match in {area}</h2>
          <p className="type-body text-muted mt-2 max-w-sm">
            Try a different search or clear your filters.
            {elsewhere.length > 0
              ? ` Providers are also available in ${elsewhere.map((c) => c.city).join(', ')}. Change your city at the top of the page.`
              : ''}
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

/** The services inside the chosen category, so prices compare like with like. */
function ServiceChips({
  category,
  current,
  raw,
}: {
  category: { services: { id: string; name: string }[] };
  current?: string;
  raw: SearchParams;
}) {
  const href = (id?: string) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      const v = first(value);
      if (v && key !== 'service' && key !== 'limit') params.set(key, v);
    }
    if (id) params.set('service', id);
    return `/explore?${params.toString()}`;
  };
  const chip = (active: boolean) =>
    `type-body-s inline-flex h-10 items-center rounded-full px-4 whitespace-nowrap ${
      active ? 'bg-dark text-on-dark' : 'bg-page shadow-card'
    }`;
  return (
    <div className="mt-5">
      <p className="type-caption text-muted">Choose a service to compare prices</p>
      <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
        <li>
          <Link href={href()} scroll={false} className={chip(!current)}>
            All services
          </Link>
        </li>
        {category.services.map((s) => (
          <li key={s.id}>
            <Link href={href(s.id)} scroll={false} className={chip(current === s.id)}>
              {s.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
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
