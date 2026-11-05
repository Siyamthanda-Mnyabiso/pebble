import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { Cell, Table } from '@/components/admin/parts';
import { loadStats, requireAdmin } from '@/lib/admin';
import { formatRand } from '@/lib/money';

export const metadata: Metadata = { title: 'Reports' };

export default function Page() {
  return (
    <>
      <PageHeading title="Reports" subtitle="The last six months at a glance." />
      <Suspense fallback={<div className="bg-subtle mt-8 h-72 rounded-lg" aria-hidden />}>
        <Months />
      </Suspense>
    </>
  );
}

async function Months() {
  await requireAdmin('/admin/reports');
  const { months } = await loadStats();
  return (
    <Table
      head={[
        'Month',
        'Bookings',
        'Completed',
        'Cancelled',
        'Cancellation rate',
        'Pebble commission',
      ]}
    >
      {months.map((m) => (
        <tr key={m.month}>
          <Cell className="font-semibold">{m.month}</Cell>
          <Cell>{m.bookings}</Cell>
          <Cell>{m.completed}</Cell>
          <Cell>{m.cancelled}</Cell>
          <Cell>
            {m.bookings ? `${Math.round((m.cancelled / m.bookings) * 100)}%` : '–'}
          </Cell>
          <Cell>{formatRand(m.fees_cents)}</Cell>
        </tr>
      ))}
    </Table>
  );
}
