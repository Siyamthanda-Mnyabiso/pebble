import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { Cell, Empty, Pill, Stat, Stats, Table } from '@/components/admin/parts';
import { RowAction } from '@/components/admin/row-action';
import { categoryLabel } from '@/data/providers';
import { providerStatus, requireAdmin, type ProviderRow } from '@/lib/admin';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/server';
import { setProviderState } from '../actions';

export const metadata: Metadata = { title: 'Providers' };

const tabs = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'suspended', label: 'Suspended' },
] as const;

const tone = { active: 'green', pending: 'grey', suspended: 'red' } as const;

export default function Page({ searchParams }: PageProps<'/admin/providers'>) {
  return (
    <>
      <PageHeading
        title="Providers"
        subtitle="Review, approve and manage service providers."
      />
      <Suspense fallback={<div className="bg-subtle mt-8 h-96 rounded-lg" aria-hidden />}>
        <List searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function List({
  searchParams,
}: Pick<PageProps<'/admin/providers'>, 'searchParams'>) {
  await requireAdmin('/admin/providers');
  const params = await searchParams;
  const status = typeof params.status === 'string' ? params.status : 'all';
  const q = (typeof params.q === 'string' ? params.q : '').trim().toLowerCase();

  const supabase = await createClient();
  const [{ data }, { data: done }] = await Promise.all([
    supabase
      .from('providers')
      .select('slug, name, category, city, area, rating, review_count, verified, active')
      .order('name')
      .returns<ProviderRow[]>(),
    supabase.from('bookings').select('provider_slug').eq('status', 'completed'),
  ]);
  const all = data ?? [];
  const jobs = new Map<string, number>();
  for (const b of done ?? [])
    jobs.set(b.provider_slug, (jobs.get(b.provider_slug) ?? 0) + 1);

  const counts = {
    all: all.length,
    pending: all.filter((p) => providerStatus(p) === 'pending').length,
    suspended: all.filter((p) => providerStatus(p) === 'suspended').length,
  };
  const rated = all.filter((p) => p.review_count > 0);
  const avg = rated.length
    ? (rated.reduce((s, p) => s + p.rating, 0) / rated.length).toFixed(1)
    : '–';

  const rows = all
    .filter((p) => status === 'all' || providerStatus(p) === status)
    .filter(
      (p) =>
        !q || `${p.name} ${p.city} ${p.area} ${p.category}`.toLowerCase().includes(q),
    );

  return (
    <>
      <Stats>
        <Stat
          label="Active providers"
          value={all.filter((p) => providerStatus(p) === 'active').length}
        />
        <Stat label="Awaiting verification" value={counts.pending} />
        <Stat label="Suspended" value={counts.suspended} />
        <Stat label="Average rating" value={avg} />
      </Stats>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <nav
          aria-label="Filter providers"
          className="bg-subtle inline-flex rounded-full p-1"
        >
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={
                t.id === 'all' ? '/admin/providers' : `/admin/providers?status=${t.id}`
              }
              aria-current={status === t.id ? 'page' : undefined}
              className={cn(
                'type-body-s rounded-full px-4 py-2 font-semibold',
                status === t.id ? 'bg-dark text-on-dark' : 'text-muted',
              )}
            >
              {t.label} ({counts[t.id]})
            </Link>
          ))}
        </nav>
        <form role="search" className="min-w-[220px] flex-1 sm:max-w-sm">
          {status !== 'all' ? <input type="hidden" name="status" value={status} /> : null}
          <label className="sr-only" htmlFor="q">
            Search providers
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search providers"
            className="border-line-strong bg-page type-body-s h-11 w-full rounded-full border px-5"
          />
        </form>
      </div>

      {rows.length === 0 ? (
        <Empty>No providers match.</Empty>
      ) : (
        <Table head={['Provider', 'Category', 'City', 'Rating', 'Jobs', 'Status', '']}>
          {rows.map((p) => {
            const s = providerStatus(p);
            return (
              <tr key={p.slug}>
                <Cell className="font-semibold">
                  {s === 'suspended' ? (
                    p.name
                  ) : (
                    <Link href={`/providers/${p.slug}`} className="hover:underline">
                      {p.name}
                    </Link>
                  )}
                </Cell>
                <Cell>{categoryLabel(p.category)}</Cell>
                <Cell>{p.area ? `${p.area}, ${p.city}` : p.city}</Cell>
                <Cell>{p.review_count > 0 ? p.rating.toFixed(1) : '–'}</Cell>
                <Cell>{jobs.get(p.slug) ?? 0}</Cell>
                <Cell>
                  <Pill tone={tone[s]}>{s}</Pill>
                </Cell>
                <Cell>
                  <span className="flex flex-wrap gap-2">
                    {s === 'pending' ? (
                      <RowAction
                        label="Approve"
                        action={setProviderState.bind(null, p.slug, 'approve')}
                      />
                    ) : null}
                    {s === 'suspended' ? (
                      <RowAction
                        label="Reinstate"
                        variant="secondary"
                        action={setProviderState.bind(null, p.slug, 'reinstate')}
                      />
                    ) : (
                      <RowAction
                        label="Suspend"
                        variant="secondary"
                        confirm
                        action={setProviderState.bind(null, p.slug, 'suspend')}
                      />
                    )}
                  </span>
                </Cell>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
