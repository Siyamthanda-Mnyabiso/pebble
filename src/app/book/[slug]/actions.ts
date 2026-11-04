'use server';

export type BookingInput = {
  providerSlug: string;
  service: string;
  date: string;
  time: string;
  address: string;
  notes: string;
};

export type BookingResult =
  { ok: true; reference: string } | { ok: false; error: string };

/**
 * Validates a booking request and returns a reference.
 *
 * TODO(supabase): insert into `bookings`, notify the provider, and send the
 * confirmation email. Nothing is stored yet.
 */
export async function createBooking(input: BookingInput): Promise<BookingResult> {
  if (!input.providerSlug || !input.service) {
    return { ok: false, error: 'Choose a service to book.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.time)) {
    return { ok: false, error: 'Choose a date and time.' };
  }
  if (input.address.trim().length < 5 || input.address.length > 200) {
    return { ok: false, error: 'Enter the address where the job takes place.' };
  }
  if (input.notes.length > 500) {
    return { ok: false, error: 'Keep instructions under 500 characters.' };
  }

  const reference = `PB-${Math.floor(10000 + Math.random() * 90000)}`;
  return { ok: true, reference };
}
