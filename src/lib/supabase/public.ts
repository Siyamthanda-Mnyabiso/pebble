import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * A cookie-free client for public data (providers, services, hours). It runs as
 * the anonymous role, so it can only read what row level security exposes to
 * everyone, and it works in places that have no request, like static params.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
