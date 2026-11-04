import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { Cell, Empty, Pill, Table } from '@/components/admin/parts';
import { RowAction } from '@/components/admin/row-action';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { setReviewHidden } from '../actions';

export const metadata: Metadata = { title: 'Reviews' };

type Review = {
  id: string;
  user_id: string;
  provider_slug: string;
  rating: number;
  body: string;
  hidden: boolean;
  created_at: string;
};

export default function Page() {
  return (
    <>
      <PageHeading
        title="Reviews"
        subtitle="Hide reviews that break the rules. Hidden reviews leave provider pages."
      />
      <Suspense fallback={<div className="bg-subtle mt-8 h-96 rounded-lg" aria-hidden />}>
        <List />
      </Suspense>
    </>
  );
}

async function List() {
  await requireAdmin('/admin/reviews');
  const supabase = await createClient();
  const { data } = await supabase
    .from('reviews')
    .select('id, user_id, provider_slug, rating, body, hidden, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
    .returns<Review[]>();
  const rows = data ?? [];
  if (rows.length === 0) return <Empty>No reviews yet.</Empty>;

  const [{ data: providers }, { data: people }] = await Promise.all([
    supabase.from('providers').select('slug, name'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', [...new Set(rows.map((r) => r.user_id))]),
  ]);
  const provider = new Map(
    (providers ?? []).map((p) => [p.slug as string, p.name as string]),
  );
  const person = new Map(
    (people ?? []).map((p) => [p.id as string, p.full_name as string]),
  );

  return (
    <Table head={['Provider', 'Customer', 'Rating', 'Review', 'Status', '']}>
      {rows.map((r) => (
        <tr key={r.id}>
          <Cell className="font-semibold">
            {provider.get(r.provider_slug) ?? r.provider_slug}
          </Cell>
          <Cell>{person.get(r.user_id) || 'Customer'}</Cell>
          <Cell>{r.rating} / 5</Cell>
          <Cell className="max-w-[320px] break-words">
            {r.body || <span className="text-muted">No comment</span>}
          </Cell>
          <Cell>
            <Pill tone={r.hidden ? 'grey' : 'green'}>
              {r.hidden ? 'Hidden' : 'Visible'}
            </Pill>
          </Cell>
          <Cell>
            <RowAction
              label={r.hidden ? 'Show' : 'Hide'}
              variant="secondary"
              action={setReviewHidden.bind(null, r.id, !r.hidden)}
            />
          </Cell>
        </tr>
      ))}
    </Table>
  );
}
