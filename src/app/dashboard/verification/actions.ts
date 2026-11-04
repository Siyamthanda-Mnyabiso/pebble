'use server';

import { revalidatePath } from 'next/cache';
import { requireProvider } from '@/lib/dashboard';
import { sendEmail, verificationEmail } from '@/lib/email';
import { createClient } from '@/lib/supabase/server';

export type VerificationState = { error?: string; saved?: boolean; notice?: string };

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
