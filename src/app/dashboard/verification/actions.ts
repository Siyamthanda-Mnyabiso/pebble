'use server';

import { revalidatePath } from 'next/cache';
import { requireProvider } from '@/lib/dashboard';
import { sendEmail, verificationEmail } from '@/lib/email';
import { createClient } from '@/lib/supabase/server';

export type VerificationState = { error?: string; saved?: boolean; notice?: string };

export async function saveIntroVideo(
  _: VerificationState,
  formData: FormData,
): Promise<VerificationState> {
  const { provider } = await requireProvider('/dashboard/verification');
  if (!provider) return { error: 'Create your listing first.' };
  const raw = formData.get('video');
  const url = typeof raw === 'string' ? raw.trim() : '';
  if (!/^https:\/\/[^\s]{4,255}$/.test(url)) {
    return { error: 'Paste a full link that starts with https://' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('provider_verification')
    .update({ intro_video_url: url })
    .eq('provider_slug', provider.slug)
    .select('provider_slug');
  if (error || !data || data.length === 0) {
    return {
      error: 'Your video link could not be saved. You cannot change it while we review.',
    };
  }
  revalidatePath('/dashboard/verification');
  return { saved: true };
}

/** Sends the listing for review. Only the database decides whether it is complete. */
export async function submitForReview(): Promise<VerificationState> {
  const { user, provider } = await requireProvider('/dashboard/verification');
  if (!provider) return { error: 'Create your listing first.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_for_review');
  if (error) {
    return {
      error: error.message.startsWith('Not ready')
        ? `${error.message.replace('Not ready: ', 'Still missing: ')}.`
        : 'We could not submit your listing. Please try again.',
    };
  }
  revalidatePath('/dashboard', 'layout');
  revalidatePath('/admin', 'layout');
  const mail = verificationEmail('submitted', provider.name);
  const emailed = await sendEmail(user.email, mail.subject, mail.text);
  return {
    saved: true,
    notice: emailed
      ? 'Submitted. We emailed you a confirmation.'
      : 'Submitted. You will be notified here when there is an update.',
  };
}
