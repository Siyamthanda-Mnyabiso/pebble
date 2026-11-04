import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type Profile = {
  full_name: string;
  phone: string;
  address: string;
  role: 'customer' | 'provider';
  provider_slug: string | null;
  notify_bookings: boolean;
  notify_reminders: boolean;
  notify_offers: boolean;
  created_at: string;
};

/** The signed-in user, or null. Verified with Supabase, not just read from the cookie. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

/** Redirects to sign in (and back) when nobody is signed in. */
export async function requireUser(next: string) {
  const user = await getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return user;
}

export const getProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select(
      'full_name, phone, address, role, provider_slug, notify_bookings, notify_reminders, notify_offers, created_at',
    )
    .eq('id', userId)
    .single<Profile>();
  return data;
});

/** Slugs of the signed-in user's saved providers (empty when signed out). */
export const getSavedSlugs = cache(async (): Promise<Set<string>> => {
  const user = await getUser();
  if (!user) return new Set();
  const supabase = await createClient();
  const { data } = await supabase
    .from('saved_providers')
    .select('provider_slug')
    .eq('user_id', user.id);
  return new Set((data ?? []).map((row) => row.provider_slug));
});

/** Only ever redirect to a path on this site. */
export function safeNext(value: FormDataEntryValue | string | null | undefined) {
  const next = typeof value === 'string' ? value : '';
  return next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')
    ? next
    : '/account';
}
