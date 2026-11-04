'use server';

import { revalidatePath } from 'next/cache';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type StatusResult = { ok: true } | { ok: false; error: string };

const ALLOWED = ['confirmed', 'completed', 'cancelled'] as const;

/**
 * Providers confirm, complete or cancel bookings for their listing. Customers
 * cancel their own. Which changes are legal is enforced in the database.
 */
export async function setBookingStatus(
  bookingId: string,
  status: (typeof ALLOWED)[number],
): Promise<StatusResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };
  if (!ALLOWED.includes(status)) return { ok: false, error: 'That is not allowed.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', bookingId)
    .select('id');

  if (error) {
    return {
      ok: false,
      error: error.message.includes('on or after')
        ? 'You can mark a job complete on or after its date.'
        : 'That change is not allowed for this booking.',
    };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: 'We could not find that booking.' };
  }
  revalidatePath('/dashboard', 'layout');
  revalidatePath('/account', 'layout');
  return { ok: true };
}
