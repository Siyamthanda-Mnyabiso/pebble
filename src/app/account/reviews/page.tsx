import type { Metadata } from 'next';
import Image from 'next/image';
import { Suspense } from 'react';
import { RateStars } from '@/components/account/rate-stars';
import { EmptyState, PageHeading } from '@/components/account/ui';
import { Icon } from '@/components/icons';
import { getProvider } from '@/data/providers';
import { getProfile, requireUser } from '@/lib/auth';
import { formatDay, formatMonthYear } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Your reviews' };

export default function ReviewsPage() {
  return (
    <>
      <PageHeading
        title="Your reviews"
        subtitle="Reviews help great providers get found."
      />
      <Suspense
        fallback={<div className="bg-subtle mt-10 h-64 rounded-lg" aria-hidden />}
      >
        <Reviews />
      </Suspense>
    </>
  );
}

type Waiting = {
  id: string;
  provider_slug: string;
  service: string;
  scheduled_date: string;
};
type Written = {
  id: string;
  rating: number;
  body: string;
  created_at: string;
  provider_slug: string;
  bookings: { service: string } | null;
};

async function Reviews() {
  const user = await requireUser('/account/reviews');
  const supabase = await createClient();
  const profile = await getProfile(user.id);

  const [{ data: completed }, { data: written }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, provider_slug, service, scheduled_date')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('scheduled_date', { ascending: false })
      .returns<Waiting[]>(),
    supabase
      .from('reviews')
      .select('id, rating, body, created_at, provider_slug, bookings(service)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .returns<Written[]>(),
  ]);

  const { data: reviewedBookings } = await supabase
    .from('reviews')
    .select('booking_id')
    .eq('user_id', user.id);
  const done = new Set((reviewedBookings ?? []).map((r) => r.booking_id));
  const waiting = (completed ?? []).filter((b) => !done.has(b.id));
  const firstName = (profile?.full_name ?? '').split(' ')[0] || 'You';

  return (
    <>
      <section className="mt-10">
        <h2 className="type-h2">Waiting for your review</h2>
        {waiting.length > 0 ? (
          <ul className="bg-page shadow-card divide-line mt-5 divide-y rounded-xl px-4 sm:px-6">
            {await Promise.all(
              waiting.map(async (b) => {
                const provider = await getProvider(b.provider_slug);
                return (
                  <li key={b.id} className="flex flex-wrap items-center gap-4 py-5">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-md">
                      <Image
                        src={provider?.image ?? '/images/cleaning.jpg'}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="type-body font-semibold">
                        {b.service}
                        {provider ? ` · ${provider.name}` : ''}
                      </p>
                      <p className="type-body-s text-muted">
                        {formatDay(b.scheduled_date)}
                      </p>
                    </div>
                    <RateStars bookingId={b.id} />
                  </li>
                );
              }),
            )}
          </ul>
        ) : (
          <p className="type-body-s text-muted mt-4">
            Finished jobs will appear here so you can rate them.
          </p>
        )}
      </section>

      <section className="mt-12">
        <h2 className="type-h2">Reviews you have written</h2>
        {(written ?? []).length > 0 ? (
          <ul className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {(written ?? []).map((review) => (
              <li key={review.id} className="bg-page shadow-card rounded-lg p-6">
                <span
                  role="img"
                  aria-label={`${review.rating} out of 5 stars`}
                  className="flex gap-0.5"
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <Icon
                      key={i}
                      name={i < review.rating ? 'starFilled' : 'star'}
                      size={16}
                    />
                  ))}
                </span>
                {review.body ? <p className="type-body mt-4">{review.body}</p> : null}
                <p className="type-body-s mt-4 font-semibold">{firstName}</p>
                <p className="type-caption text-muted">
                  {review.bookings?.service ?? 'Service'} ·{' '}
                  {formatMonthYear(review.created_at)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No reviews yet"
            body="Rate a finished job and it will show up here."
          />
        )}
      </section>
    </>
  );
}
