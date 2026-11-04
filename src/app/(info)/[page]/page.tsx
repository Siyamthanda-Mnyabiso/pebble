import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { InfoPage } from '@/components/layout/info-page';
import { infoPages } from '@/data/pages';

export function generateStaticParams() {
  return Object.keys(infoPages).map((page) => ({ page }));
}

export async function generateMetadata({
  params,
}: PageProps<'/[page]'>): Promise<Metadata> {
  const { page } = await params;
  const content = infoPages[page];
  return content ? { title: content.title, description: content.description } : {};
}

export default function Page({ params }: PageProps<'/[page]'>) {
  return (
    <Suspense>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<PageProps<'/[page]'>, 'params'>) {
  const { page } = await params;
  const content = infoPages[page];
  if (!content) notFound();
  return <InfoPage content={content} />;
}
