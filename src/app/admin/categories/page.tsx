import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { Cell, Empty, Pill, Table } from '@/components/admin/parts';
import { ButtonLink } from '@/components/ui/button';
import { requireAdmin } from '@/lib/admin';
import { loadAdminCategories } from '@/lib/admin-categories';
import { cn } from '@/lib/cn';

export const metadata: Metadata = { title: 'Categories' };

export default function Page({ searchParams }: PageProps<'/admin/categories'>) {
  return (
    <>
      <PageHeading
        title="Categories"
        subtitle="Create categories and manage the services inside them. Changes show on the site straight away."
      />
      <div className="mt-5">
        <ButtonLink href="/admin/categories/new">Add category</ButtonLink>
      </div>
      <Suspense fallback={<div className="bg-subtle mt-8 h-96 rounded-lg" aria-hidden />}>
        <List searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function List({
  searchParams,
}: Pick<PageProps<'/admin/categories'>, 'searchParams'>) {
  await requireAdmin('/admin/categories');
  const params = await searchParams;
  const view =
    params.view === 'active' || params.view === 'inactive' ? params.view : 'all';
  const showOld = params.old === '1';

  const everything = await loadAdminCategories();
  const current = everything.filter((c) => !c.is_legacy);
  const old = everything.filter((c) => c.is_legacy);
  const counts = {
    all: current.length,
    active: current.filter((c) => c.active).length,
    inactive: current.filter((c) => !c.active).length,
  };
  const rows = [
    ...current.filter((c) => view === 'all' || (view === 'active') === c.active),
    ...(showOld ? old : []),
  ];

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'inactive', label: 'Inactive' },
  ] as const;

  return (
    <>
      <nav
        aria-label="Filter categories"
        className="bg-subtle mt-8 inline-flex rounded-full p-1"
      >
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={t.id === 'all' ? '/admin/categories' : `/admin/categories?view=${t.id}`}
            aria-current={view === t.id ? 'page' : undefined}
            className={cn(
              'type-body-s rounded-full px-4 py-2 font-semibold',
              view === t.id ? 'bg-dark text-on-dark' : 'text-muted',
            )}
          >
            {t.label} {counts[t.id]}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <Empty>No categories here.</Empty>
      ) : (
        <Table
          head={[
            'Category',
            'Services',
            'Providers',
            'Instant booking',
            'Checks',
            'Status',
            '',
          ]}
        >
          {rows.map((c) => (
            <tr key={c.id} className={cn(!c.active && 'text-muted')}>
              <Cell className="font-semibold">{c.name}</Cell>
              <Cell>{c.services.filter((s) => s.active).length}</Cell>
              <Cell>
                {c.providers_total === 0
                  ? '0'
                  : `${c.providers_live} live of ${c.providers_total}`}
              </Cell>
              <Cell>{c.allow_instant_booking ? 'Allowed' : 'Manual only'}</Cell>
              <Cell>
                {c.requires_licence
                  ? 'Licence'
                  : c.enhanced_verification
                    ? 'Enhanced'
                    : 'Standard'}
              </Cell>
              <Cell>
                <Pill tone={c.active ? 'green' : 'grey'}>
                  {c.active ? 'Active' : 'Inactive'}
                </Pill>
              </Cell>
              <Cell className="text-right">
                <ButtonLink
                  href={`/admin/categories/${c.id}`}
                  variant="secondary"
                  size="sm"
                >
                  Edit
                </ButtonLink>
              </Cell>
            </tr>
          ))}
        </Table>
      )}

      {old.length > 0 ? (
        <div className="bg-subtle type-body-s mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg px-5 py-4">
          <p className="text-muted">
            {old.length} older categories from before the catalogue stay in place for the
            providers already in them. They are closed to new providers.
          </p>
          <ButtonLink
            href={showOld ? '/admin/categories' : '/admin/categories?old=1'}
            variant="secondary"
            size="sm"
          >
            {showOld ? 'Hide' : 'Show'}
          </ButtonLink>
        </div>
      ) : null}
    </>
  );
}
