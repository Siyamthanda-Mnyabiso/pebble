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
