import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { NotLinked } from '@/components/dashboard/booking-row';
import { CategoriesForm, ListingForm } from '@/components/dashboard/forms';
import { getCategoryNames, listSelectableCategories } from '@/data/categories';
import { loadOwnCategories, requireProvider } from '@/lib/dashboard';
import { loadVerification } from '@/lib/verification';

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
  const [selectable, names, own, { verification }] = await Promise.all([
    listSelectableCategories(),
    getCategoryNames(),
    loadOwnCategories(provider.slug, provider.category),
    loadVerification(provider.slug),
  ]);

  // Providers can keep an old main category they already have, but only pick current ones.
  const mainOptions = selectable.some((c) => c.slug === provider.category)
    ? selectable.map((c) => ({ slug: c.slug, label: c.label }))
    : [
        { slug: provider.category, label: names[provider.category] ?? provider.category },
        ...selectable.map((c) => ({ slug: c.slug, label: c.label })),
      ];
  const status = verification?.status;
  const approved = status === 'approved';
  const categoryOptions = selectable.map((c) => ({
    slug: c.slug,
    label: c.label,
    description:
      approved &&
      (c.requiresLicence ||
        c.requiresBusinessRegistration ||
        c.enhancedVerification ||
        c.requirements.length > 0)
        ? `${c.description} Needs extra checks, so contact support to add it.`
        : c.description,
  }));
  const locked =
    status === 'pending_review'
      ? 'Your listing is under review. You can change categories once the review is done.'
      : undefined;

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
        categories={mainOptions}
        listing={{
          name: provider.name,
          category: provider.category,
          tagline: provider.tagline,
          about: provider.about,
          area: provider.area,
          city: provider.city,
          replyTime: provider.replyTime,
          experience: provider.experience,
          skills: provider.skills,
        }}
      />
      <CategoriesForm
        options={categoryOptions}
        selected={own.map((c) => c.slug)}
        main={provider.category}
        locked={locked}
      />
    </>
  );
}
