import 'server-only';
import { getProviderLite } from '@/data/providers';
import { createClient } from '@/lib/supabase/server';

export type Thread = {
  bookingId: string;
  name: string;
  image?: string;
  service: string;
  last: string;
  lastAt: string;
  unread: number;
};

type Row = {
  booking_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

/** Conversations the caller is part of, newest first. Row security limits what comes back. */
export async function loadThreads(
  userId: string,
  side: 'customer' | 'provider',
): Promise<Thread[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('messages')
    .select('booking_id, sender_id, body, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(300)
    .returns<Row[]>();
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const ids = [...new Set(rows.map((r) => r.booking_id))];
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, user_id, provider_slug, service')
    .in('id', ids);
  const byId = new Map((bookings ?? []).map((b) => [b.id as string, b]));

  const customerIds =
    side === 'provider'
      ? [...new Set((bookings ?? []).map((b) => b.user_id as string))]
      : [];
  const { data: customers } = customerIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', customerIds)
    : { data: [] };
  const customerName = new Map(
    (customers ?? []).map((c) => [c.id as string, c.full_name as string]),
  );

  const threads: Thread[] = [];
  for (const id of ids) {
    const booking = byId.get(id);
    if (!booking) continue;
    const mine = rows.filter((r) => r.booking_id === id);
    const provider =
      side === 'customer' ? await getProviderLite(booking.provider_slug) : null;
    threads.push({
      bookingId: id,
      name:
        side === 'customer'
          ? (provider?.name ?? 'Provider')
          : customerName.get(booking.user_id) || 'Customer',
      image: provider?.image,
      service: booking.service,
      last: mine[0].body,
      lastAt: mine[0].created_at,
      unread: mine.filter((r) => r.sender_id !== userId && !r.read_at).length,
    });
  }
  return threads;
}
