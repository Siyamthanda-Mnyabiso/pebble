import { serviceCategories, type ServiceCategory } from '@/data/home';
import { createPublicClient } from '@/lib/supabase/public';

/** Provider data now lives in Supabase. The UI only calls the functions below. */

export type ProviderService = {
  id: string;
  name: string;
  detail: string;
  /** Starting price in rand. */
  fromPrice: number;
};

export type ProviderReview = {
  quote: string;
  rating: number;
  name: string;
  service: string;
  date: string;
  avatar?: string;
};

export type AvailabilityDay = {
  /** ISO date, e.g. 2026-11-06. */
  iso: string;
  day: string;
  date: number;
  /** Open start times that day; empty means the provider is off. */
  times: string[];
  /** Number of open start times. */
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

type ProviderRow = {
  slug: string;
  name: string;
  category: string;
  tagline: string;
  about: string;
  area: string;
  distance_km: number;
  verified: boolean;
  image: string;
  gallery: string[];
  work: string[];
  reply_time: string;
  rating: number;
  review_count: number;
  sample_reviews: Omit<ProviderReview, 'rating'>[];
  provider_services: {
    id: string;
    name: string;
    detail: string;
    from_price: number;
    position: number;
  }[];
};

const COLUMNS =
  'slug, name, category, tagline, about, area, distance_km, verified, image, gallery, work, reply_time, rating, review_count, sample_reviews, provider_services(id, name, detail, from_price, position)';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAYS_AHEAD = 14;

function saNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    iso: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
  };
}

function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

type Schedule = {
  hours: Map<number, string[]>;
  off: Set<string>;
  booked: Set<string>;
};

/** Open start times per day: weekly hours, minus time off, taken slots and past times. */
function buildAvailability(from: string, hourNow: number, schedule: Schedule) {
  const days: AvailabilityDay[] = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const iso = addDays(from, i);
    const [y, m, d] = iso.split('-').map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    let times = schedule.off.has(iso) ? [] : (schedule.hours.get(weekday) ?? []);
    times = times.filter(
      (t) =>
        !schedule.booked.has(`${iso}|${t}`) && (i > 0 || Number(t.slice(0, 2)) > hourNow),
    );
    days.push({ iso, day: WEEKDAYS[weekday], date: d, times, slots: times.length });
  }
  return days;
}

function toProvider(
  row: ProviderRow,
  availability: AvailabilityDay[],
  reviews: ProviderReview[],
): Provider {
  const services = [...row.provider_services]
    .sort((a, b) => a.position - b.position)
    .map((s) => ({ id: s.id, name: s.name, detail: s.detail, fromPrice: s.from_price }));
  return {
    slug: row.slug,
    name: row.name,
    category: row.category,
    tagline: row.tagline,
    about: row.about,
    area: row.area,
    distanceKm: row.distance_km,
    verified: row.verified,
    rating: Number(row.rating),
    reviewCount: row.review_count,
    fromPrice: services.length ? Math.min(...services.map((s) => s.fromPrice)) : 0,
    image: row.image,
    gallery: row.gallery,
    work: row.work,
    services,
    reviews,
    availability,
    availableToday: (availability[0]?.slots ?? 0) > 0,
    replyTime: row.reply_time,
  };
}

async function loadSchedules(slugs: string[]) {
  const supabase = createPublicClient();
  const now = saNow();
  const to = addDays(now.iso, DAYS_AHEAD - 1);
  const [hours, off, booked] = await Promise.all([
    supabase
      .from('provider_hours')
      .select('provider_slug, weekday, times')
      .in('provider_slug', slugs),
    supabase
      .from('provider_time_off')
      .select('provider_slug, day')
      .in('provider_slug', slugs)
      .gte('day', now.iso)
      .lte('day', to),
    Promise.all(
      slugs.map(async (slug) => {
        const { data } = await supabase.rpc('booked_times', {
          p_slug: slug,
          p_from: now.iso,
          p_to: to,
        });
        return [slug, (data ?? []) as { day: string; t: string }[]] as const;
      }),
    ),
  ]);

  const result = new Map<string, Schedule>();
  for (const slug of slugs) {
    result.set(slug, { hours: new Map(), off: new Set(), booked: new Set() });
  }
  for (const h of hours.data ?? [])
    result.get(h.provider_slug)?.hours.set(h.weekday, h.times);
  for (const o of off.data ?? []) result.get(o.provider_slug)?.off.add(o.day);
  for (const [slug, rows] of booked) {
    for (const b of rows) result.get(slug)?.booked.add(`${b.day}|${b.t}`);
  }
  return { schedules: result, now };
}

function monthYear(iso: string) {
  const [y, m] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export type ProviderFilters = {
  q?: string;
  category?: string;
  minRating?: number;
  minPrice?: number;
  maxPrice?: number;
  availability?: string;
  sort?: string;
  limit?: number;
};

export type ProviderSearch = { providers: Provider[]; total: number };

export async function searchProviders(filters: ProviderFilters): Promise<ProviderSearch> {
  const supabase = createPublicClient();
  let query = supabase.from('providers').select(COLUMNS).eq('active', true);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.minRating) query = query.gte('rating', filters.minRating);
  const { data } = await query.returns<ProviderRow[]>();
  const rows = data ?? [];

  const { schedules, now } = await loadSchedules(rows.map((r) => r.slug));
  const q = filters.q?.trim().toLowerCase();

  let found = rows
    .filter((row) => row.provider_services.length > 0)
    .map((row) =>
      toProvider(row, buildAvailability(now.iso, now.hour, schedules.get(row.slug)!), []),
    )
    .filter((p) => {
      if (q) {
        const haystack = `${p.name} ${p.category} ${p.tagline} ${p.services
          .map((s) => s.name)
          .join(' ')}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.minPrice !== undefined && p.fromPrice < filters.minPrice) return false;
      if (filters.maxPrice !== undefined && p.fromPrice > filters.maxPrice) return false;
      if (filters.availability === 'today' && !p.availableToday) return false;
      return true;
    });

  switch (filters.sort) {
    case 'price-asc':
      found = found.sort((a, b) => a.fromPrice - b.fromPrice);
      break;
    case 'price-desc':
      found = found.sort((a, b) => b.fromPrice - a.fromPrice);
      break;
    default:
      found = found.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
  }

  return { providers: found.slice(0, filters.limit ?? 6), total: found.length };
}

/** Top providers shown on the home page. */
export async function listFeaturedProviders(limit = 4): Promise<Provider[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from('providers')
    .select(COLUMNS)
    .eq('active', true)
    .eq('featured', true)
    .order('rating', { ascending: false })
    .limit(limit)
    .returns<ProviderRow[]>();
  return (data ?? [])
    .filter((row) => row.provider_services.length > 0)
    .map((row) => toProvider(row, [], []));
}

export async function getProvider(slug: string): Promise<Provider | undefined> {
  const supabase = createPublicClient();
  const { data: row } = await supabase
    .from('providers')
    .select(COLUMNS)
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle<ProviderRow>();
  if (!row || row.provider_services.length === 0) return undefined;

  const [{ schedules, now }, real] = await Promise.all([
    loadSchedules([slug]),
    supabase.rpc('provider_reviews', { p_slug: slug }),
  ]);

  const realReviews: ProviderReview[] = (
    (real.data ?? []) as {
      rating: number;
      body: string;
      first_name: string;
      service: string;
      created_at: string;
    }[]
  ).map((r) => ({
    quote: r.body,
    rating: r.rating,
    name: r.first_name,
    service: r.service,
    date: monthYear(r.created_at.slice(0, 10)),
  }));
  const sample = (row.sample_reviews ?? []).map((r) => ({ ...r, rating: 5 }));

  return toProvider(
    row,
    buildAvailability(now.iso, now.hour, schedules.get(slug)!),
    [...realReviews, ...sample].slice(0, 6),
  );
}

/** A provider without availability or reviews: cheap, for lists and lookups. */
export async function getProviderLite(slug: string): Promise<Provider | undefined> {
  const supabase = createPublicClient();
  const { data: row } = await supabase
    .from('providers')
    .select(COLUMNS)
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle<ProviderRow>();
  return row ? toProvider(row, [], []) : undefined;
}

export async function listProviderSlugs(): Promise<string[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from('providers')
    .select('slug, provider_services(id)')
    .eq('active', true);
  return (data ?? []).filter((r) => r.provider_services.length > 0).map((r) => r.slug);
}

export function categoryLabel(slug: string): string | undefined {
  return serviceCategories.find((c) => c.slug === slug)?.label;
}
