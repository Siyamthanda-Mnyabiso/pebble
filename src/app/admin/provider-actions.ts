'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { sendEmail, verificationEmail } from '@/lib/email';
import { createClient } from '@/lib/supabase/server';
import { ADMIN_CHECKS } from '@/lib/verification';

export type DecisionResult = { ok: true; notice: string } | { ok: false; error: string };

type Outcome = { email: string | null; name: string };

function refresh(slug: string) {
  revalidatePath('/admin', 'layout');
  revalidatePath('/dashboard', 'layout');
  revalidatePath('/explore');
  revalidatePath('/');
  revalidatePath(`/providers/${slug}`);
}

function message(error: { message: string }) {
  // The database explains what is missing in plain words. Show that, not internals.
  return /^(Cannot approve|Only|Tell|Give|Unknown)/.test(error.message)
    ? error.message
    : 'That did not work. Please try again.';
}

async function decide(
  slug: string,
  rpc: string,
  args: Record<string, string>,
  email: 'approved' | 'changes_requested' | 'rejected' | 'suspended' | 'reinstated',
  note: string,
): Promise<DecisionResult> {
  await requireAdmin(`/admin/providers/${slug}`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(rpc, { p_slug: slug, ...args });
  if (error) return { ok: false, error: message(error) };
  refresh(slug);
  const outcome = data as Outcome;
  const mail = verificationEmail(email, outcome.name, note);
  const sent = await sendEmail(outcome.email, mail.subject, mail.text);
  return {
    ok: true,
    notice: sent
      ? 'Done. The provider was notified here and by email.'
      : 'Done. The provider was notified in the app. Email is not set up yet, so none was sent.',
  };
}

export async function approveProvider(slug: string) {
  return decide(slug, 'admin_approve_provider', {}, 'approved', '');
}

export async function requestChanges(slug: string, note: string) {
  return decide(
    slug,
    'admin_request_changes',
    { p_note: note },
    'changes_requested',
    note,
  );
}

export async function rejectProvider(slug: string, note: string) {
  return decide(slug, 'admin_reject_provider', { p_note: note }, 'rejected', note);
}

export async function suspendProvider(slug: string, note: string) {
  return decide(slug, 'admin_suspend_provider', { p_note: note }, 'suspended', note);
}

export async function reinstateProvider(slug: string) {
  return decide(slug, 'admin_reinstate_provider', {}, 'reinstated', '');
}

export async function setCheck(
  slug: string,
  field: string,
  value: boolean,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin(`/admin/providers/${slug}`);
  if (!ADMIN_CHECKS.some((c) => c.field === field))
    return { ok: false, error: 'Unknown item.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_vetting', {
    p_slug: slug,
    p_field: field,
    p_value: value,
  });
  if (error) return { ok: false, error: message(error) };
  revalidatePath(`/admin/providers/${slug}`);
  return { ok: true };
}
