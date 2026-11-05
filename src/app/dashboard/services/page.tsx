import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { NotLinked } from '@/components/dashboard/booking-row';
import { AddServiceCard, ServiceItem } from '@/components/dashboard/forms';
import { loadOwnServices, loadPlatformTerms, requireProvider } from '@/lib/dashboard';

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
  const [services, terms] = await Promise.all([
    loadOwnServices(provider.slug),
    loadPlatformTerms(),
  ]);
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
      <AddServiceCard
        commissionPercent={terms.commissionPercent}
        paymentsEnabled={terms.paymentsEnabled}
      />
    </>
  );
}
