'use server';

import { revalidatePath } from 'next/cache';
import { getProvider } from '@/data/providers';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; reason: 'auth' | 'invalid' | 'failed' };

export async function setSavedProvider(slug: string, saved: boolean): Promise<Result> {
  const user = await getUser();
  if (!user) return { ok: false, reason: 'auth' };
  if (!(await getProvider(slug))) return { ok: false, reason: 'invalid' };

  const supabase = await createClient();
  const { error } = saved
    ? await supabase
        .from('saved_providers')
        .upsert(
          { user_id: user.id, provider_slug: slug },
          { onConflict: 'user_id,provider_slug' },
        )
    : await supabase
        .from('saved_providers')
        .delete()
        .eq('user_id', user.id)
        .eq('provider_slug', slug);

  if (error) return { ok: false, reason: 'failed' };
  revalidatePath('/account/saved');
  return { ok: true };
}

export async function submitReview(bookingId: string, rating: number): Promise<Result> {
  const user = await getUser();
  if (!user) return { ok: false, reason: 'auth' };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, reason: 'invalid' };
  }

  const supabase = await createClient();
  const { data: booking } = await supabase
    .from('bookings')
    .select('provider_slug')
    .eq('id', bookingId)
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .maybeSingle();
  if (!booking) return { ok: false, reason: 'invalid' };

  const { error } = await supabase.from('reviews').insert({
    user_id: user.id,
    booking_id: bookingId,
    provider_slug: booking.provider_slug,
    rating,
  });
  if (error) return { ok: false, reason: 'failed' };
  revalidatePath('/account/reviews');
  return { ok: true };
}

export type ProfileState = { error?: string; saved?: boolean };

export async function updateProfile(
  _: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await getUser();
  if (!user) return { error: 'Please sign in again.' };

  const str = (key: string) => String(formData.get(key) ?? '').trim();
  const fullName = str('full_name');
  const phone = str('phone');
  const address = str('address');

  if (fullName.length < 2) return { error: 'Enter your full name.' };
  if (phone && !/^\+?[0-9 ()-]{7,20}$/.test(phone)) {
    return { error: 'Enter a valid mobile number.' };
  }
  if (address.length > 200) return { error: 'Keep your address under 200 characters.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      phone,
      address,
      notify_bookings: formData.get('notify_bookings') === 'on',
      notify_reminders: formData.get('notify_reminders') === 'on',
      notify_offers: formData.get('notify_offers') === 'on',
    })
    .eq('id', user.id);

  if (error) return { error: 'We could not save your changes. Please try again.' };
  revalidatePath('/account/settings');
  return { saved: true };
}

export async function changePassword(
  _: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await getUser();
  if (!user) return { error: 'Please sign in again.' };

  const password = String(formData.get('password') ?? '');
  if (password.length < 8) return { error: 'Your password needs at least 8 characters.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: 'We could not update your password. Please try again.' };
  return { saved: true };
}
