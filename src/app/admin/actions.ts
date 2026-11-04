'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

export type AdminResult = { ok: true } | { ok: false; error: string };

const failed: AdminResult = { ok: false, error: 'That did not work. Please try again.' };

function refresh() {
  revalidatePath('/admin', 'layout');
  revalidatePath('/explore');
  revalidatePath('/');
}

export async function setProviderState(
  slug: string,
  state: 'approve' | 'suspend' | 'reinstate',
): Promise<AdminResult> {
  await requireAdmin('/admin/providers');
  const supabase = await createClient();
  const { data: current } = await supabase
    .from('providers')
    .select('verified')
    .eq('slug', slug)
    .maybeSingle();
  if (!current) return failed;
  const { error } = await supabase.rpc('admin_set_provider', {
    p_slug: slug,
    // Approving verifies; suspending and reinstating leave verification alone.
    p_verified: state === 'approve' ? true : current.verified,
    p_active: state !== 'suspend',
  });
  if (error) return failed;
  refresh();
  revalidatePath(`/providers/${slug}`);
  return { ok: true };
}

export async function resolvePayout(
  id: string,
  status: 'paid' | 'rejected',
): Promise<AdminResult> {
  await requireAdmin('/admin/payments');
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_resolve_payout', {
    p_id: id,
    p_status: status,
    p_note: '',
  });
  if (error) return failed;
  refresh();
  return { ok: true };
}

export async function setReviewHidden(id: string, hidden: boolean): Promise<AdminResult> {
  await requireAdmin('/admin/reviews');
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_review_hidden', {
    p_id: id,
    p_hidden: hidden,
  });
  if (error) return failed;
  refresh();
  revalidatePath('/providers/[slug]', 'page');
  return { ok: true };
}
