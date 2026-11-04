'use server';

import { getProvider } from '@/data/providers';
import { getUser } from '@/lib/auth';
import { BOOKING_TIMES, SERVICE_FEE } from '@/lib/booking';
import { createClient } from '@/lib/supabase/server';

export type BookingInput = {
  providerSlug: string;
  service: string;
  date: string;
  time: string;
  address: string;
  notes: string;
};

export type BookingResult =
  { ok: true; reference: string } | { ok: false; error: string; needsSignIn?: boolean };

/**
 * Creates a pending booking for the signed-in customer. Price, provider,
 * service and date are all checked against server data, never trusted from the form.
 */
export async function createBooking(input: BookingInput): Promise<BookingResult> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: 'Sign in to confirm your booking.', needsSignIn: true };
  }

  const provider = await getProvider(input.providerSlug);
  const service = provider?.services.find((s) => s.name === input.service);
  if (!provider || !service) return { ok: false, error: 'Choose a service to book.' };

  const day = provider.availability.find((d) => d.iso === input.date);
  if (!day || day.slots === 0 || !BOOKING_TIMES.includes(input.time)) {
    return { ok: false, error: 'Choose an available date and time.' };
  }

  const address = input.address.trim();
  if (address.length < 5 || address.length > 200) {
    return { ok: false, error: 'Enter the address where the job takes place.' };
  }
  const notes = input.notes.trim();
  if (notes.length > 500) {
    return { ok: false, error: 'Keep instructions under 500 characters.' };
  }

  const supabase = await createClient();
  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = `PB-${Math.floor(10000 + Math.random() * 90000)}`;
    const { error } = await supabase.from('bookings').insert({
      reference,
      user_id: user.id,
      provider_slug: provider.slug,
      service: service.name,
      scheduled_date: day.iso,
      start_time: input.time,
      address,
      notes,
      price_cents: service.fromPrice * 100,
      fee_cents: SERVICE_FEE * 100,
    });
    if (!error) return { ok: true, reference };
    if (error.code !== '23505') break; // only retry on a reference collision
  }
  return { ok: false, error: 'We could not save your booking. Please try again.' };
}
