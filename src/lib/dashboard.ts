import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getOwnProvider } from '@/data/providers';
import { getProfile, requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { BookingStatus } from '@/lib/booking-status';

export type DashboardBooking = {
  id: string;
  reference: string;
  user_id: string;
  service: string;
  scheduled_date: string;
  start_time: string;
  address: string;
  notes: string;
  price_cents: number;
  status: BookingStatus;
  expires_at: string | null;
  duration_minutes: number;
  booking_mode: 'instant' | 'request';
  commission_cents: number;
  earning_cents: number;
  payment_status: string;
  payout_status: PayoutStatus;
  confirm_by: string | null;
};

export type PayoutStatus =
  'none' | 'held' | 'eligible' | 'on_hold' | 'processing' | 'paid' | 'failed';

export type Customer = { full_name: string; phone: string };

/** The signed-in provider and their listing. Anyone else is sent away. */
export const requireProvider = cache(async (next: string) => {
  const user = await requireUser(next);
  const profile = await getProfile(user.id);
  if (!profile || profile.role !== 'provider') redirect('/account/bookings');
  const provider = profile.provider_slug
    ? await getOwnProvider(profile.provider_slug)
    : null;
  return { user, profile, provider };
});

/** Bookings for the provider's listing plus the customers who made them. */
export async function loadBookings(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('bookings')
    .select(
      'id, reference, user_id, service, scheduled_date, start_time, address, notes, price_cents, status, expires_at, duration_minutes, booking_mode, commission_cents, earning_cents, payment_status, payout_status, confirm_by',
    )
    .eq('provider_slug', slug)
    .order('scheduled_date', { ascending: true })
    .returns<DashboardBooking[]>();
  const bookings = data ?? [];

  const ids = [...new Set(bookings.map((b) => b.user_id))];
  const customers = new Map<string, Customer>();
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', ids);
    for (const p of profiles ?? []) {
      customers.set(p.id, { full_name: p.full_name, phone: p.phone });
    }
  }
  return { bookings, customers };
}

/** Weekly hours (by weekday) and upcoming blocked dates for the provider's listing. */
export async function loadSchedule(slug: string, from: string) {
  const supabase = await createClient();
  const [hours, off] = await Promise.all([
    supabase.from('provider_hours').select('weekday, times').eq('provider_slug', slug),
    supabase
      .from('provider_time_off')
      .select('day')
      .eq('provider_slug', slug)
      .gte('day', from)
      .order('day'),
  ]);
  const byDay: Record<number, string[]> = {};
  for (const h of hours.data ?? []) byDay[h.weekday] = h.times;
  return { hours: byDay, off: (off.data ?? []).map((o) => o.day as string) };
}

export type OwnService = {
  id: string;
  /** The catalogue service this is, or null for a free-text service from before the catalogue. */
  serviceId: string | null;
  instantAllowed: boolean;
  name: string;
  detail: string;
  fromPrice: number;
  durationMinutes: number;
  active: boolean;
  instantBooking: boolean;
};

/** The categories the provider works in, with the catalogue services they could offer. */
export type OwnCategory = {
  id: string;
  slug: string;
  label: string;
  legacy: boolean;
  main: boolean;
  allowInstantBooking: boolean;
  /** Every catalogue service of the category, including ones switched off. */
  serviceIds: string[];
  services: { id: string; name: string; suggestedDurationMinutes: number }[];
};

export async function loadOwnCategories(
  slug: string,
  mainSlug: string,
): Promise<OwnCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('provider_categories')
    .select(
      'category:service_categories(id, slug, name, is_legacy, allow_instant_booking, sort_order, category_services(id, name, active, sort_order, suggested_duration_minutes))',
    )
    .eq('provider_slug', slug)
    .returns<
      {
        category: {
          id: string;
          slug: string;
          name: string;
          is_legacy: boolean;
          allow_instant_booking: boolean;
          sort_order: number;
          category_services: {
            id: string;
            name: string;
            active: boolean;
            sort_order: number;
            suggested_duration_minutes: number;
          }[];
        } | null;
      }[]
    >();
  return (data ?? [])
    .flatMap((row) => (row.category ? [row.category] : []))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      label: c.name,
      legacy: c.is_legacy,
      main: c.slug === mainSlug,
      allowInstantBooking: c.allow_instant_booking,
      serviceIds: c.category_services.map((x) => x.id),
      services: c.category_services
        .filter((x) => x.active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((x) => ({
          id: x.id,
          name: x.name,
          suggestedDurationMinutes: x.suggested_duration_minutes,
        })),
    }));
}

/** The provider's own services, including ones switched off. */
export async function loadOwnServices(
  slug: string,
  categories: OwnCategory[],
): Promise<OwnService[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('provider_services')
    .select(
      'id, service_id, name, detail, from_price, duration_minutes, active, instant_booking',
    )
    .eq('provider_slug', slug)
    .order('position');
  const main = categories.find((c) => c.main);
  return (data ?? []).map((s) => {
    const home = s.service_id
      ? categories.find((c) => c.serviceIds.includes(s.service_id))
      : main;
    return {
      id: s.id,
      serviceId: s.service_id,
      instantAllowed: home?.allowInstantBooking ?? true,
      name: s.name,
      detail: s.detail,
      fromPrice: s.from_price,
      durationMinutes: s.duration_minutes,
      active: s.active,
      instantBooking: s.instant_booking,
    };
  });
}

/** Gap between jobs and the most jobs in a day. */
export async function loadPreferences(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('provider_booking_settings')
    .select('buffer_minutes, max_daily_bookings')
    .eq('provider_slug', slug)
    .maybeSingle();
  return {
    bufferMinutes: data?.buffer_minutes ?? 0,
    maxDaily: data?.max_daily_bookings ?? null,
  };
}

export type PlatformTerms = {
  commissionPercent: number;
  paymentsEnabled: boolean;
};

/** What every provider is allowed to know: the commission and whether payments are live. */
export async function loadPlatformTerms(): Promise<PlatformTerms> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('public_booking_settings');
  const s = (data ?? {}) as Record<string, number>;
  return {
    commissionPercent: Number(s.commission_percent ?? 10),
    paymentsEnabled: Number(s.payments_enabled ?? 0) === 1,
  };
}
