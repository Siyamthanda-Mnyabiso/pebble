import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { NotLinked } from '@/components/dashboard/booking-row';
import { AddServiceCard, ServiceItem } from '@/components/dashboard/forms';
import {
  loadOwnCategories,
  loadOwnServices,
  loadPlatformTerms,
  requireProvider,
} from '@/lib/dashboard';

export const metadata: Metadata = { title: 'Services' };

export default function ServicesPage() {
  return (
    <>
      <PageHeading
        title="Services and prices"
        subtitle="Set your own prices. Choose instant booking or approve each request yourself."
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
  const { provider } = await requireProvider('/dashboard/services');
  if (!provider) return <NotLinked />;
  const categories = await loadOwnCategories(provider.slug, provider.category);
  const [services, terms] = await Promise.all([
    loadOwnServices(provider.slug, categories),
    loadPlatformTerms(),
  ]);

  // Providers from before the catalogue can still type a service; everyone else picks from the
  // services of their categories that they have not added yet.
  const legacy = categories.find((c) => c.main)?.legacy ?? false;
  const taken = new Set(services.map((s) => s.serviceId));
  const groups = legacy
    ? undefined
    : categories
        .filter((c) => !c.legacy)
        .map((c) => ({
          label: c.label,
          allowInstantBooking: c.allowInstantBooking,
          services: c.services.filter((x) => !taken.has(x.id)),
        }))
        .filter((g) => g.services.length > 0);

  return (
    <>
      {services.length === 0 ? (
        <p className="type-body-s bg-subtle mt-6 rounded-lg px-4 py-3">
          Add at least one service to appear in search and take bookings.
        </p>
      ) : (
        <ul className="bg-page shadow-card divide-line mt-8 max-w-[760px] divide-y rounded-xl px-4 sm:px-6">
          {services.map((service) => (
            <li key={service.id}>
              <ServiceItem
                service={service}
                canDelete={services.length > 1}
                commissionPercent={terms.commissionPercent}
                paymentsEnabled={terms.paymentsEnabled}
              />
            </li>
          ))}
        </ul>
      )}
      {groups && groups.length === 0 ? (
        <p className="type-body-s text-muted mt-6">
          You have added every service in your categories. Add another category on the
          Listing page to offer more.
        </p>
      ) : (
        <AddServiceCard
          groups={groups}
          commissionPercent={terms.commissionPercent}
          paymentsEnabled={terms.paymentsEnabled}
        />
      )}
    </>
  );
}
