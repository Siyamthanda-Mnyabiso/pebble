import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
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

export default async function Page({ params }: PageProps<'/[page]'>) {
  // Checked before anything streams, so an unknown address gets a real 404 status.
  const { page } = await params;
  const content = infoPages[page];
  if (!content) notFound();
  return <InfoPage content={content} />;
}
