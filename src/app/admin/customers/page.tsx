import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { Cell, Empty, Table } from '@/components/admin/parts';
import { requireAdmin } from '@/lib/admin';
import { formatDay } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Customers' };

export default function Page() {
  return (
    <>
      <PageHeading
        title="Customers"
        subtitle="People who have signed up to book services."
      />
      <Suspense fallback={<div className="bg-subtle mt-8 h-96 rounded-lg" aria-hidden />}>
        <List />
      </Suspense>
    </>
  );
}

async function List() {
  await requireAdmin('/admin/customers');
  const supabase = await createClient();
  const [{ data: people }, { data: bookings }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, phone, created_at')
      .eq('role', 'customer')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('bookings').select('user_id'),
  ]);
  const counts = new Map<string, number>();
  for (const b of bookings ?? []) counts.set(b.user_id, (counts.get(b.user_id) ?? 0) + 1);
  const rows = people ?? [];

  if (rows.length === 0) return <Empty>No customers yet.</Empty>;
  return (
    <Table head={['Name', 'Phone', 'Joined', 'Bookings']}>
      {rows.map((p) => (
        <tr key={p.id}>
          <Cell className="font-semibold">{p.full_name || 'No name'}</Cell>
          <Cell>{p.phone || '–'}</Cell>
          <Cell>{formatDay(p.created_at.slice(0, 10), { year: true })}</Cell>
          <Cell>{counts.get(p.id) ?? 0}</Cell>
        </tr>
      ))}
    </Table>
  );
}
