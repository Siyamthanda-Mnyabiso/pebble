import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getProfile, requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/** Only platform admins get through. Everyone else sees the not-found page. */
export const requireAdmin = cache(async (next: string) => {
  const user = await requireUser(next);
  const profile = await getProfile(user.id);
  if (!profile?.is_admin) notFound();
  return { user, profile };
});

export type AdminStats = {
  bookings_total: number;
  bookings_30d: number;
  bookings_prev_30d: number;
  providers_active: number;
  providers_pending: number;
  providers_suspended: number;
  customers: number;
  fees_cents: number;
  volume_cents: number;
  pending_payouts: number;
  pending_payout_cents: number;
  paid_payout_cents: number;
  avg_rating: number;
  by_day: { day: string; n: number }[];
  by_category: { category: string; n: number }[];
  months: {
    month: string;
    bookings: number;
    completed: number;
    cancelled: number;
    fees_cents: number;
  }[];
};

export async function loadStats(): Promise<AdminStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_stats');
  if (error || !data) throw new Error('Could not load platform stats');
  return data as AdminStats;
}

export type ProviderRow = {
  slug: string;
  name: string;
  category: string;
  city: string;
  area: string;
  rating: number;
  review_count: number;
  verified: boolean;
  active: boolean;
};
