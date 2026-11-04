'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { submitReview } from '@/app/account/actions';
import { Icon } from '@/components/icons';

export function RateStars({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [hover, setHover] = useState(0);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <div role="group" aria-label="Rate this job" className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            disabled={pending}
            aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
            onMouseEnter={() => setHover(value)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => setHover(value)}
            onBlur={() => setHover(0)}
            onClick={() =>
              startTransition(async () => {
                setError('');
                const result = await submitReview(bookingId, value);
                if (result.ok) router.refresh();
                else setError('Could not save your review. Please try again.');
              })
            }
            className="inline-flex size-9 items-center justify-center rounded-full disabled:opacity-50"
          >
            <Icon name={value <= hover ? 'starFilled' : 'star'} size={26} />
          </button>
        ))}
      </div>
      {error ? (
        <p className="type-caption text-danger mt-1" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
