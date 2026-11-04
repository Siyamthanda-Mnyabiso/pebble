import type { Metadata } from 'next';
import { InfoPage } from '@/components/layout/info-page';
import { providerResources } from '@/data/pages';

export const metadata: Metadata = { title: providerResources.title };

export default function Page() {
  return <InfoPage content={providerResources} />;
}
