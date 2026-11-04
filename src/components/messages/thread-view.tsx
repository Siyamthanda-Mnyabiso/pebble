import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/icons';
import { ChatPanel } from '@/components/messages/chat-panel';
import type { ChatMessage } from '@/components/messages/chat-panel';
import { getProviderLite } from '@/data/providers';
import { formatDay } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One conversation, for either side. Row security decides whether the caller may see it. */
export async function ThreadView({
  id,
  userId,
  side,
}: {
  id: string;
  userId: string;
  side: 'customer' | 'provider';
}) {
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, user_id, provider_slug, service, scheduled_date, status')
    .eq('id', id)
    .maybeSingle();
  if (!booking) notFound();

  let otherName = 'your provider';
  if (side === 'customer') {
    otherName = (await getProviderLite(booking.provider_slug))?.name ?? otherName;
  } else {
    const { data: customer } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', booking.user_id)
      .maybeSingle();
    otherName = customer?.full_name || 'the customer';
  }

  const { data: messages } = await supabase
    .from('messages')
    .select('id, sender_id, body, created_at')
    .eq('booking_id', id)
    .order('created_at', { ascending: true })
    .returns<ChatMessage[]>();

  const base = side === 'customer' ? '/account' : '/dashboard';

  return (
    <div className="max-w-[760px]">
      <Link
        href={`${base}/messages`}
        className="type-body-s text-muted hover:text-ink inline-flex items-center gap-1.5 py-1 font-semibold"
      >
        <Icon name="skipBack" size={14} />
        All messages
      </Link>
      <h1 className="type-h1 mt-3">{otherName}</h1>
      <p className="type-body-s text-muted mt-1">
        <Link href={`${base}/bookings/${booking.id}`} className="underline">
          {booking.service} on {formatDay(booking.scheduled_date)}
        </Link>
      </p>
      <div className="mt-6">
        <ChatPanel
          bookingId={booking.id}
          userId={userId}
          otherName={otherName}
          initial={messages ?? []}
        />
      </div>
    </div>
  );
}
