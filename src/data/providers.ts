import type { ServiceCategory } from '@/data/home';
import { serviceCategories } from '@/data/home';

/**
 * Static provider data. The async functions at the bottom are the seam where
 * Supabase queries will go; the UI only ever calls those.
 */

export type ProviderService = {
  name: string;
  detail: string;
  /** Starting price in rand. */
  fromPrice: number;
};

export type ProviderReview = {
  quote: string;
  name: string;
  service: string;
  date: string;
  avatar: string;
};

export type AvailabilityDay = {
  /** ISO date, e.g. 2026-11-06. */
  iso: string;
  day: string;
  date: number;
  /** Open booking slots; 0 means the provider is off. */
  slots: number;
};

export type Provider = {
  slug: string;
  name: string;
  category: ServiceCategory['slug'];
  tagline: string;
  about: string;
  area: string;
  distanceKm: number;
  verified: boolean;
  rating: number;
  reviewCount: number;
  fromPrice: number;
  image: string;
  gallery: string[];
  work: string[];
  services: ProviderService[];
  reviews: ProviderReview[];
  availability: AvailabilityDay[];
  availableToday: boolean;
  replyTime: string;
};

const week: AvailabilityDay[] = [
  { iso: '2026-11-05', day: 'Thu', date: 5, slots: 6 },
  { iso: '2026-11-06', day: 'Fri', date: 6, slots: 6 },
  { iso: '2026-11-07', day: 'Sat', date: 7, slots: 2 },
  { iso: '2026-11-08', day: 'Sun', date: 8, slots: 0 },
  { iso: '2026-11-09', day: 'Mon', date: 9, slots: 6 },
  { iso: '2026-11-10', day: 'Tue', date: 10, slots: 6 },
  { iso: '2026-11-11', day: 'Wed', date: 11, slots: 6 },
];

const cleaningWork = [
  '/images/room-living.jpg',
  '/images/work-bathroom-reno.jpg',
  '/images/cleaning.jpg',
  '/images/bathroom-vanity.jpg',
];

const sampleReviews: ProviderReview[] = [
  {
    quote:
      'On time, friendly and left the flat spotless. The kitchen has never looked better.',
    name: 'Thandi N.',
    service: 'Home cleaning',
    date: 'October 2026',
    avatar: '/images/portrait-f.jpg',
  },
  {
    quote:
      'Booked on short notice and everything was signed off by the landlord first time.',
    name: 'Daniel P.',
    service: 'Move-out',
    date: 'October 2026',
    avatar: '/images/portrait-m.jpg',
  },
  {
    quote: 'Reliable and fair. We now have them come every second Friday.',
    name: 'Amina S.',
    service: 'Recurring',
    date: 'September 2026',
    avatar: '/images/pro-puff.jpg',
  },
];

function cleaner(
  p: Pick<Provider, 'slug' | 'name' | 'rating' | 'reviewCount' | 'fromPrice' | 'image'> &
    Partial<Provider>,
): Provider {
  return {
    category: 'cleaning',
    tagline: 'Professional cleaning services',
    about:
      'A detail-focused team that keeps your spaces fresh, clean and stress-free. Eco-friendly products, all supplies included and a 100% re-clean guarantee.',
    area: 'Cape Town',
    distanceKm: 12,
    verified: true,
    gallery: cleaningWork,
    work: cleaningWork,
    services: [
      {
        name: 'Home cleaning',
        detail: '3 to 5 hours · Supplies included',
        fromPrice: p.fromPrice,
      },
      {
        name: 'Deep cleaning',
        detail: '5 to 8 hours · Kitchen, bathrooms, appliances',
        fromPrice: p.fromPrice + 400,
      },
      {
        name: 'Office cleaning',
        detail: 'Evenings and weekends · Recurring discounts',
        fromPrice: p.fromPrice + 150,
      },
      {
        name: 'Move-in / move-out',
        detail: 'Empty property · Same-day available',
        fromPrice: p.fromPrice + 500,
      },
    ],
    reviews: sampleReviews,
    availability: week,
    availableToday: true,
    replyTime: 'Usually replies within 1 hour.',
    ...p,
  };
}

const providers: Provider[] = [
  cleaner({
    slug: 'spark-clean-co',
    name: 'Spark Clean Co.',
    rating: 4.9,
    reviewCount: 86,
    fromPrice: 450,
    image: '/images/pro-braids.jpg',
  }),
  cleaner({
    slug: 'cape-home-care',
    name: 'Cape Home Care',
    rating: 4.8,
    reviewCount: 64,
    fromPrice: 400,
    image: '/images/pro-van.jpg',
    distanceKm: 8,
  }),
  cleaner({
    slug: 'freshspace',
    name: 'FreshSpace',
    rating: 5.0,
    reviewCount: 41,
    fromPrice: 500,
    image: '/images/pro-puff.jpg',
    distanceKm: 5,
    availableToday: false,
  }),
  cleaner({
    slug: 'sparkle-and-co',
    name: 'Sparkle & Co',
    rating: 4.7,
    reviewCount: 52,
    fromPrice: 380,
    image: '/images/hero-woman.jpg',
    distanceKm: 15,
  }),
  cleaner({
    slug: 'tidy-nest-cleaners',
    name: 'Tidy Nest Cleaners',
    rating: 4.9,
    reviewCount: 97,
    fromPrice: 420,
    image: '/images/portrait-f.jpg',
    distanceKm: 10,
    availableToday: false,
  }),
  cleaner({
    slug: 'mr-shine-home-care',
    name: 'Mr Shine Home Care',
    rating: 4.8,
    reviewCount: 73,
    fromPrice: 390,
    image: '/images/portrait-m.jpg',
    distanceKm: 7,
  }),
  {
    ...cleaner({
      slug: 'naledi-hair-studio',
      name: 'Naledi Hair Studio',
      rating: 4.9,
      reviewCount: 73,
      fromPrice: 350,
      image: '/images/beauty.jpg',
    }),
    category: 'beauty',
    tagline: 'Braids, styling and treatments',
    about:
      'A friendly studio for braids, silk presses and treatments. Book a chair or have us come to you.',
    gallery: ['/images/beauty.jpg', '/images/pro-braids.jpg', '/images/portrait-f.jpg'],
    work: ['/images/beauty.jpg', '/images/pro-braids.jpg', '/images/portrait-f.jpg'],
    services: [
      { name: 'Braids', detail: '3 to 6 hours · Hair included', fromPrice: 350 },
      { name: 'Silk press', detail: '2 to 3 hours · Wash and style', fromPrice: 450 },
      { name: 'Treatments', detail: '1 hour · Deep conditioning', fromPrice: 280 },
    ],
  },
  {
    ...cleaner({
      slug: 'flowline-plumbing',
      name: 'Flowline Plumbing',
      rating: 4.8,
      reviewCount: 58,
      fromPrice: 350,
      image: '/images/work-pipework.jpg',
    }),
    category: 'plumbing',
    tagline: 'Leaks, geysers and blocked drains',
    about:
      'Licensed plumbers who arrive on time, fix it properly and clean up after themselves.',
    gallery: ['/images/work-pipework.jpg', '/images/work-bathroom-tap.jpg'],
    work: ['/images/work-pipework.jpg', '/images/work-bathroom-tap.jpg'],
    services: [
      { name: 'Leak repair', detail: '1 to 2 hours · Parts extra', fromPrice: 350 },
      {
        name: 'Geyser service',
        detail: '2 to 4 hours · Certificate issued',
        fromPrice: 900,
      },
      { name: 'Drain unblocking', detail: '1 hour · Same-day available', fromPrice: 450 },
    ],
  },
  {
    ...cleaner({
      slug: 'bright-spark-electrical',
      name: 'Bright Spark Electrical',
      rating: 4.7,
      reviewCount: 39,
      fromPrice: 420,
      image: '/images/electrical.jpg',
    }),
    category: 'electrical',
    tagline: 'Wiring, lighting and compliance certificates',
    about:
      'Registered electricians for repairs, installs and certificates of compliance.',
    gallery: ['/images/electrical.jpg'],
    work: ['/images/electrical.jpg'],
    services: [
      { name: 'Fault finding', detail: '1 to 3 hours', fromPrice: 420 },
      { name: 'Lighting install', detail: 'Per fitting · Supply extra', fromPrice: 180 },
      {
        name: 'Compliance certificate',
        detail: 'Inspection and report',
        fromPrice: 1200,
      },
    ],
  },
];

export type ProviderFilters = {
  q?: string;
  category?: string;
  minRating?: number;
  minPrice?: number;
  maxPrice?: number;
  availability?: 'today' | 'week';
  sort?: 'recommended' | 'rating' | 'price-asc' | 'price-desc';
  limit?: number;
};

export type ProviderSearch = {
  providers: Provider[];
  total: number;
};

export async function searchProviders(filters: ProviderFilters): Promise<ProviderSearch> {
  const q = filters.q?.trim().toLowerCase();

  let found = providers.filter((p) => {
    if (filters.category && p.category !== filters.category) return false;
    if (q) {
      const haystack = `${p.name} ${p.category} ${p.tagline} ${p.services
        .map((s) => s.name)
        .join(' ')}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.minRating && p.rating < filters.minRating) return false;
    if (filters.minPrice !== undefined && p.fromPrice < filters.minPrice) return false;
    if (filters.maxPrice !== undefined && p.fromPrice > filters.maxPrice) return false;
    if (filters.availability === 'today' && !p.availableToday) return false;
    return true;
  });

  switch (filters.sort) {
    case 'rating':
      found = [...found].sort((a, b) => b.rating - a.rating);
      break;
    case 'price-asc':
      found = [...found].sort((a, b) => a.fromPrice - b.fromPrice);
      break;
    case 'price-desc':
      found = [...found].sort((a, b) => b.fromPrice - a.fromPrice);
      break;
  }

  const limit = filters.limit ?? 6;
  return { providers: found.slice(0, limit), total: found.length };
}

export async function getProvider(slug: string): Promise<Provider | undefined> {
  return providers.find((p) => p.slug === slug);
}

export async function listProviderSlugs(): Promise<string[]> {
  return providers.map((p) => p.slug);
}

export function categoryLabel(slug: string): string | undefined {
  return serviceCategories.find((c) => c.slug === slug)?.label;
}
