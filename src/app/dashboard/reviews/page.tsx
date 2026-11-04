import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EmptyState, PageHeading } from '@/components/account/ui';
import { NotLinked } from '@/components/dashboard/booking-row';
import { Icon } from '@/components/icons';
import { requireProvider } from '@/lib/dashboard';
import { formatDay } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Reviews' };

type Row = {
  id: string;
  rating: number;
  body: string;
  created_at: string;
  user_id: string;
  bookings: { service: string } | null;
};

export default function ReviewsPage() {
  return (
    <>
      <PageHeading title="Reviews" subtitle="What customers say about your work." />
      <Suspense
        fallback={<div className="bg-subtle mt-10 h-64 rounded-lg" aria-hidden />}
      >
        <Reviews />
      </Suspense>
    </>
  );
}

async function Reviews() {
  const { provider } = await requireProvider('/dashboard/reviews');
  if (!provider) return <NotLinked />;

  const supabase = await createClient();
  const { data } = await supabase
    .from('reviews')
    .select('id, rating, body, created_at, user_id, bookings(service)')
    .eq('provider_slug', provider.slug)
    .order('created_at', { ascending: false })
    .returns<Row[]>();
  const reviews = data ?? [];

  if (reviews.length === 0) {
    return (
      <EmptyState
        title="No reviews yet"
        body="After you complete a job, the customer can rate it and it will appear here."
      />
    );
  }

  const ids = [...new Set(reviews.map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', ids);
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <>
      <p className="type-body mt-8">
        <span className="type-stat">{average.toFixed(1)}</span>{' '}
        <span className="text-muted">
          from {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
        </span>
      </p>
      <ul className="bg-page shadow-card divide-line mt-6 divide-y rounded-xl px-4 sm:px-6">
        {reviews.map((r) => (
          <li key={r.id} className="py-5">
            <span
              className="inline-flex gap-0.5"
              role="img"
              aria-label={`${r.rating} out of 5 stars`}
            >
              {Array.from({ length: r.rating }, (_, i) => (
                <Icon key={i} name="starFilled" size={16} />
              ))}
            </span>
            {r.body ? <p className="type-body mt-2">{r.body}</p> : null}
            <p className="type-caption text-muted mt-2">
              {names.get(r.user_id)?.split(' ')[0] || 'A customer'} ·{' '}
              {r.bookings?.service ?? 'Job'} · {formatDay(r.created_at.slice(0, 10))}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
