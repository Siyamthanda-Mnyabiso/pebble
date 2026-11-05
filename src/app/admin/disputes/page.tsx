import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { Empty, Pill } from '@/components/admin/parts';
import { DisputeDecision } from '@/components/admin/dispute-decision';
import { DECISION_LABEL, REASON_LABEL } from '@/components/booking/dispute-panels';
import { requireAdmin } from '@/lib/admin';
import { cn } from '@/lib/cn';
import { formatDay } from '@/lib/dates';
import { formatRand } from '@/lib/money';
import { EvidenceGallery } from '@/components/booking/evidence';
import { loadEvidence } from '@/lib/disputes';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Disputes' };

export default function Page({ searchParams }: PageProps<'/admin/disputes'>) {
  return (
    <>
      <PageHeading
        title="Disputes"
        subtitle="Jobs customers have reported. Payouts stay held until you decide."
      />
      <Suspense fallback={<div className="bg-subtle mt-8 h-96 rounded-lg" aria-hidden />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}

type Dispute = {
  id: string;
  booking_id: string;
  reason: string;
  details: string;
  provider_reply: string | null;
  status: 'open' | 'resolved';
  decision: keyof typeof DECISION_LABEL | null;
  decision_note: string | null;
  refund_cents: number | null;
  payout_cents: number | null;
  created_at: string;
  bookings: {
    service: string;
    scheduled_date: string;
    price_cents: number;
    commission_cents: number;
    earning_cents: number;
    payment_status: string;
    payout_status: string;
    user_id: string;
    provider_slug: string;
  };
};

async function Content({
  searchParams,
}: {
  searchParams: PageProps<'/admin/disputes'>['searchParams'];
}) {
  await requireAdmin('/admin/disputes');
  const { id } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from('disputes')
    .select(
      'id, booking_id, reason, details, provider_reply, status, decision, decision_note, refund_cents, payout_cents, created_at, bookings(service, scheduled_date, price_cents, commission_cents, earning_cents, payment_status, payout_status, user_id, provider_slug)',
    )
    .order('status', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)
    .returns<Dispute[]>();
  const disputes = data ?? [];
  if (disputes.length === 0)
    return <Empty>No disputes. Nothing has been reported.</Empty>;

  const selected = disputes.find((d) => d.id === id) ?? disputes[0];
  const [{ data: customer }, { data: provider }, { data: messages }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', selected.bookings.user_id)
      .maybeSingle(),
    supabase
      .from('providers')
      .select('name')
      .eq('slug', selected.bookings.provider_slug)
      .maybeSingle(),
    supabase
      .from('messages')
      .select('id, sender_id, body, created_at')
      .eq('booking_id', selected.booking_id)
      .order('created_at'),
  ]);
  const evidence = await loadEvidence(supabase, selected.id, selected.bookings.user_id);
  const b = selected.bookings;
  const sent = (iso: string) =>
    new Intl.DateTimeFormat('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));

  return (
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[360px_1fr]">
      <ul className="bg-page shadow-card flex flex-col gap-1 rounded-xl p-3">
        {disputes.map((d) => (
          <li key={d.id}>
            <Link
              href={`/admin/disputes?id=${d.id}`}
              className={cn(
                'flex flex-col gap-1 rounded-lg p-3',
                d.id === selected.id ? 'bg-subtle' : 'hover:bg-subtle',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="type-body-s font-semibold">
                  {d.bookings.service}, {formatDay(d.bookings.scheduled_date)}
                </span>
                <Pill tone="grey">{d.status === 'open' ? 'Open' : 'Decided'}</Pill>
              </span>
              <span className="type-caption text-muted">
                Reported {formatDay(d.created_at.slice(0, 10))}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-6">
        <section className="bg-page shadow-card rounded-xl p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="type-h3">
              {b.service}, {formatDay(b.scheduled_date)}
            </h2>
            <Pill tone="grey">
              {selected.status === 'open' ? 'Under review' : 'Decided'}
            </Pill>
          </div>
          <dl className="type-body-s mt-4 flex flex-col gap-2">
            {[
              ['Customer', customer?.full_name || 'Customer'],
              ['Provider', provider?.name || b.provider_slug],
              ['Customer paid', formatRand(b.price_cents)],
              ['Pebble commission', formatRand(b.commission_cents)],
              ['Provider earnings', formatRand(b.earning_cents)],
              [
                'Payment',
                b.payment_status === 'paid'
                  ? `Paid, payout ${b.payout_status.replace('_', ' ')}`
                  : 'Not live yet, payout held',
              ],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="bg-page shadow-card rounded-xl p-6">
          <h3 className="type-h4">What the customer reported</h3>
          <p className="type-caption text-muted mt-1">
            {REASON_LABEL[selected.reason] ?? selected.reason}
          </p>
          <p className="type-body-s mt-2">{selected.details}</p>
          <h3 className="type-h4 mt-6">Provider reply</h3>
          <p className="type-body-s text-muted mt-2">
            {selected.provider_reply ?? 'The provider has not replied yet.'}
          </p>
          <h3 className="type-h4 mt-6">Photo evidence</h3>
          {evidence.length === 0 ? (
            <p className="type-body-s text-muted mt-2">No photos were added.</p>
          ) : (
            <EvidenceGallery items={evidence} />
          )}
          <h3 className="type-h4 mt-6">Messages between them</h3>
          {(messages ?? []).length === 0 ? (
            <p className="type-body-s text-muted mt-2">No messages were sent.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {(messages ?? []).map((m) => (
                <li key={m.id} className="bg-subtle type-body-s rounded-lg px-4 py-2">
                  <span className="type-caption text-muted block">
                    {m.sender_id === b.user_id ? 'Customer' : 'Provider'} ·{' '}
                    {sent(m.created_at)}
                  </span>
                  {m.body}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-page shadow-card rounded-xl p-6">
          {selected.status === 'open' ? (
            <DisputeDecision id={selected.id} priceCents={b.price_cents} />
          ) : (
            <>
              <h3 className="type-h4">Decision</h3>
              <p className="type-body-s mt-2 font-semibold">
                {selected.decision ? DECISION_LABEL[selected.decision] : ''}
                {selected.refund_cents
                  ? ` · refund ${formatRand(selected.refund_cents)}`
                  : ''}
                {selected.payout_cents
                  ? ` · provider ${formatRand(selected.payout_cents)}`
                  : ''}
              </p>
              <p className="type-body-s text-muted mt-1">{selected.decision_note}</p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
