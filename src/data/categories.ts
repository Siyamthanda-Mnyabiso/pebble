import { cacheLife, cacheTag } from 'next/cache';
import { asIconName, type IconName } from '@/components/icons';
import { createPublicClient } from '@/lib/supabase/public';

/**
 * Service categories and the services inside them live in the database. Nothing here lists
 * categories by name: a category an admin adds shows up everywhere without a code change.
 */

export type CatalogService = {
  id: string;
  name: string;
  description: string;
  suggestedDurationMinutes: number;
};

export type Category = {
  id: string;
  slug: string;
  label: string;
  description: string;
  icon: IconName;
  image: string;
  allowInstantBooking: boolean;
  enhancedVerification: boolean;
  /** Live providers who offer the category. */
  providers: number;
  services: CatalogService[];
};

/** A category a provider can pick, with the rules that apply to it. */
export type SelectableCategory = Omit<Category, 'providers'> & {
  requiresLicence: boolean;
  requiresBusinessRegistration: boolean;
  minNoticeHours: number;
  maxDurationMinutes: number | null;
  requirements: { key: string; label: string; kind: string; required?: boolean }[];
};

type RawService = {
  id: string;
  name: string;
  description: string;
  suggested_duration_minutes: number;
};

type RawCategory = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  image?: string;
  allow_instant_booking: boolean;
  enhanced_verification: boolean;
  providers?: number;
  requires_licence?: boolean;
  requires_business_registration?: boolean;
  min_notice_hours?: number;
  max_duration_minutes?: number | null;
  requirements?: SelectableCategory['requirements'];
  services: RawService[];
};

export function toCatalogService(s: RawService): CatalogService {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    suggestedDurationMinutes: s.suggested_duration_minutes,
  };
}

function toBase(c: RawCategory) {
  return {
    id: c.id,
    slug: c.slug,
    label: c.name,
    description: c.description,
    icon: asIconName(c.icon),
    image: c.image ?? '',
    allowInstantBooking: c.allow_instant_booking,
    enhancedVerification: c.enhanced_verification,
    services: c.services.map(toCatalogService),
  };
}

/** Categories customers can browse: active ones, with their active services. */
export async function listCategories(): Promise<Category[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag('categories');
  const { data } = await createPublicClient().rpc('browse_categories');
  return ((data ?? []) as RawCategory[]).map((c) => ({
    ...toBase(c),
    providers: Number(c.providers ?? 0),
  }));
}

/** Categories a new provider can choose today. */
export async function listSelectableCategories(): Promise<SelectableCategory[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag('categories');
  const { data } = await createPublicClient().rpc('selectable_categories');
  return ((data ?? []) as RawCategory[]).map((c) => ({
    ...toBase(c),
    requiresLicence: c.requires_licence ?? false,
    requiresBusinessRegistration: c.requires_business_registration ?? false,
    minNoticeHours: c.min_notice_hours ?? 0,
    maxDurationMinutes: c.max_duration_minutes ?? null,
    requirements: c.requirements ?? [],
  }));
}

export type CategoryIndexEntry = {
  id: string;
  slug: string;
  label: string;
  aliasSlug?: string;
};

/** Every category visible to the public, including old ones that are replaced by another. */
async function categoryIndex(): Promise<CategoryIndexEntry[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag('categories');
  const { data } = await createPublicClient()
    .from('service_categories')
    .select('id, slug, name, alias:alias_of(slug)')
    .returns<
      { id: string; slug: string; name: string; alias: { slug: string } | null }[]
    >();
  return (data ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    label: c.name,
    aliasSlug: c.alias?.slug,
  }));
}

/** Display names by slug, for labels on providers whose category may be old or switched off. */
export async function getCategoryNames(): Promise<Record<string, string>> {
  return Object.fromEntries((await categoryIndex()).map((c) => [c.slug, c.label]));
}

/**
 * Looks up a category from a link such as /explore?category=cleaning. Old categories that were
 * replaced resolve to their replacement so existing links keep working.
 */
export async function resolveCategory(
  slug: string | undefined,
): Promise<CategoryIndexEntry | undefined> {
  if (!slug) return undefined;
  const index = await categoryIndex();
  const found = index.find((c) => c.slug === slug);
  if (!found) return undefined;
  return (found.aliasSlug && index.find((c) => c.slug === found.aliasSlug)) || found;
}
