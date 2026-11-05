import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { CategoryEditor } from '@/components/admin/category-editor';
import { requireAdmin } from '@/lib/admin';
import { loadAdminCategories } from '@/lib/admin-categories';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Edit category' };

export default function Page({ params }: PageProps<'/admin/categories/[id]'>) {
  return (
    <Suspense fallback={<div className="bg-subtle mt-8 h-96 rounded-lg" aria-hidden />}>
      <Content params={params} />
    </Suspense>
  );
}

const EVENT_LABEL: Record<string, string> = {
  category_created: 'Category created',
  category_edited: 'Category edited',
  category_activated: 'Turned on',
  category_deactivated: 'Turned off',
  service_created: 'Service added',
  service_edited: 'Service edited',
  service_activated: 'Service turned on',
  service_deactivated: 'Service turned off',
};

async function Content({ params }: Pick<PageProps<'/admin/categories/[id]'>, 'params'>) {
  const { id } = await params;
  await requireAdmin(`/admin/categories/${id}`);

  if (id === 'new') {
    return (
      <>
        <PageHeading
          title="New category"
          subtitle="It starts switched off. Add its services, then turn it on."
        />
        <CategoryEditor category={null} history={[]} />
      </>
    );
  }

  const category = (await loadAdminCategories()).find((c) => c.id === id);
  if (!category) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from('category_events')
    .select('id, kind, detail, created_at')
    .eq('category_id', id)
    .order('created_at', { ascending: false })
    .limit(8)
    .returns<
      { id: string; kind: string; detail: Record<string, unknown>; created_at: string }[]
    >();
  const history = (data ?? []).map((e) => ({
    id: e.id,
    text:
      (EVENT_LABEL[e.kind] ?? e.kind.replace(/_/g, ' ')) +
      (typeof e.detail?.name === 'string' && e.kind.startsWith('service')
        ? `: ${e.detail.name}`
        : ''),
    when: new Intl.DateTimeFormat('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(e.created_at)),
  }));

  return (
    <>
      <p className="type-body-s text-muted">
        <Link href="/admin/categories" className="hover:underline">
          Admin / Categories
        </Link>
      </p>
      <PageHeading title={category.name} subtitle="Rules, services and checks." />
      <CategoryEditor category={category} history={history} />
    </>
  );
}
