import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { NotLinked } from '@/components/dashboard/booking-row';
import { ListingForm } from '@/components/dashboard/forms';
import { requireProvider } from '@/lib/dashboard';

export const metadata: Metadata = { title: 'Listing' };

export default function ProfilePage() {
  return (
    <>
      <PageHeading
        title="Your listing"
        subtitle="What customers see at the top of your profile."
      />
      <Suspense
        fallback={<div className="bg-subtle mt-10 h-64 rounded-lg" aria-hidden />}
      >
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const { provider } = await requireProvider('/dashboard/profile');
  if (!provider) return <NotLinked />;
  return (
    <>
      <p className="type-body-s text-muted mt-4">
        Public page:{' '}
        <a className="text-ink underline" href={`/providers/${provider.slug}`}>
          /providers/{provider.slug}
        </a>
        {provider.verified
          ? ''
          : ' · Not verified yet. The badge is added by the Pebble team.'}
      </p>
      <ListingForm
        listing={{
          name: provider.name,
          category: provider.category,
          tagline: provider.tagline,
          about: provider.about,
          area: provider.area,
          city: provider.city,
          replyTime: provider.replyTime,
        }}
      />
    </>
  );
}
