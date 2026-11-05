import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { Cell, Empty, Pill, Table } from '@/components/admin/parts';
import { requireAdmin } from '@/lib/admin';
import { cn } from '@/lib/cn';
import { formatDay } from '@/lib/dates';
import { formatRand } from '@/lib/money';
import { createClient } from '@/lib/supabase/server';
import { STATUS_TONE } from '@/lib/booking-status';

export const metadata: Metadata = { title: 'Bookings' };

const statuses = [
  'all',
  'pending',
  'awaiting_payment',
  'confirmed',
  'completed',
  'cancelled',
  'declined',
  'expired',
  'disputed',
] as const;
const tone = STATUS_TONE;

type Row = {
  id: string;
  reference: string;
  user_id: string;
  provider_slug: string;
  service: string;
  scheduled_date: string;
  start_time: string;
  price_cents: number;
  fee_cents: number;
  status: keyof typeof tone;
};

export default function Page({ searchParams }: PageProps<'/admin/bookings'>) {
  return (
    <>
      <PageHeading
        title="Bookings"
        subtitle="Every booking on the platform, newest first."
      />
      <Suspense fallback={<div className="bg-subtle mt-8 h-96 rounded-lg" aria-hidden />}>
        <List searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function List({
  searchParams,
}: Pick<PageProps<'/admin/bookings'>, 'searchParams'>) {
  await requireAdmin('/admin/bookings');
  const params = await searchParams;
  const status = statuses.find((s) => s === params.status) ?? 'all';

  const supabase = await createClient();
  let query = supabase
    .from('bookings')
    .select(
      'id, reference, user_id, provider_slug, service, scheduled_date, start_time, price_cents, fee_cents, status',
    )
    .order('created_at', { ascending: false })
    .limit(150);
  if (status !== 'all') query = query.eq('status', status);
  const { data } = await query.returns<Row[]>();
  const rows = data ?? [];

  const [{ data: providers }, { data: customers }] = await Promise.all([
    supabase.from('providers').select('slug, name'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', [...new Set(rows.map((r) => r.user_id))]),
  ]);
  const providerName = new Map(
    (providers ?? []).map((p) => [p.slug as string, p.name as string]),
  );
  const customerName = new Map(
    (customers ?? []).map((c) => [c.id as string, c.full_name as string]),
  );

  return (
    <>
      <nav
        aria-label="Filter bookings"
        className="bg-subtle mt-8 inline-flex flex-wrap rounded-full p-1"
      >
        {statuses.map((s) => (
          <Link
            key={s}
            href={s === 'all' ? '/admin/bookings' : `/admin/bookings?status=${s}`}
            aria-current={status === s ? 'page' : undefined}
            className={cn(
              'type-body-s rounded-full px-4 py-2 font-semibold capitalize',
              status === s ? 'bg-dark text-on-dark' : 'text-muted',
            )}
          >
            {s}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <Empty>No bookings here yet.</Empty>
      ) : (
        <Table
          head={[
            'Reference',
            'Service',
            'Provider',
            'Customer',
            'When',
            'Total',
            'Status',
          ]}
        >
          {rows.map((b) => (
            <tr key={b.id}>
              <Cell className="font-semibold">{b.reference}</Cell>
              <Cell>{b.service}</Cell>
              <Cell>{providerName.get(b.provider_slug) ?? b.provider_slug}</Cell>
              <Cell>{customerName.get(b.user_id) || 'Customer'}</Cell>
              <Cell>
                {formatDay(b.scheduled_date)} {b.start_time.slice(0, 5)}
              </Cell>
              <Cell>{formatRand(b.price_cents + b.fee_cents)}</Cell>
              <Cell>
                <Pill tone={tone[b.status]}>{b.status}</Pill>
              </Cell>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
