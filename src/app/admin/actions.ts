'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

export type AdminResult = { ok: true } | { ok: false; error: string };

const failed = { ok: false as const, error: 'That did not work. Please try again.' };

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

const SETTING_KEYS = [
  'commission_percent',
  'urgent_response_minutes',
  'future_response_hours',
  'payment_window_minutes',
  'completion_confirm_hours',
  'max_pending_per_customer',
] as const;

/** Change one platform setting. The database checks the range, the admin role and writes the history. */
export async function updateSetting(key: string, value: number): Promise<AdminResult> {
  await requireAdmin('/admin/settings');
  if (!(SETTING_KEYS as readonly string[]).includes(key)) {
    return { ok: false, error: 'That setting cannot be changed here.' };
  }
  if (!Number.isFinite(value)) return { ok: false, error: 'Enter a number.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_setting', {
    p_key: key,
    p_value: value,
  });
  if (error) {
    return {
      ok: false,
      error: error.message.startsWith('That value') ? error.message : failed.error,
    };
  }
  revalidatePath('/admin/settings');
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Record the decision on a dispute. Both people are told. No money moves from here. */
export async function decideDispute(
  id: string,
  decision: 'release_payout' | 'refund_customer' | 'split',
  note: string,
  refundRand: number,
): Promise<AdminResult> {
  await requireAdmin('/admin/disputes');
  if (!['release_payout', 'refund_customer', 'split'].includes(decision)) return failed;
  const supabase = await createClient();
  const { error } = await supabase.rpc('resolve_dispute', {
    p_dispute: id,
    p_decision: decision,
    p_note: note,
    p_refund_cents: decision === 'split' ? Math.round(refundRand * 100) : 0,
  });
  if (error) {
    const known = ['Add a short note', 'A split refund', 'already been decided'].some(
      (m) => error.message.includes(m),
    );
    return { ok: false, error: known ? error.message : failed.error };
  }
  revalidatePath('/admin', 'layout');
  return { ok: true };
}
