'use client';

import { useState } from 'react';
import { ButtonLink } from '@/components/ui/button';
import type { ProviderService } from '@/data/providers';
import { cn } from '@/lib/cn';

const rand = new Intl.NumberFormat('en-ZA');

/** The booking card: pick a service, then book it. Sticky beside the profile on desktop. */
export function BookingCard({
  slug,
  services,
  rating,
  reviewCount,
}: {
  slug: string;
  services: ProviderService[];
  rating: number;
  reviewCount: number;
}) {
  const [selected, setSelected] = useState(services[0]?.name ?? '');
  const current = services.find((s) => s.name === selected) ?? services[0];
  const from = Math.min(...services.map((s) => s.fromPrice));

  return (
    <div className="border-line shadow-raised rounded-xl border bg-white p-5">
      <p className="flex flex-wrap items-baseline justify-between gap-2">
        <span>
          <span className="text-[22px] font-semibold">From R{rand.format(from)}</span>
        </span>
        {reviewCount > 0 ? (
          <span className="type-body-s text-muted">
            ★ {rating.toFixed(1)} · {reviewCount} reviews
          </span>
        ) : null}
      </p>

      <ul className="mt-4 flex flex-col gap-2" role="radiogroup" aria-label="Service">
        {services.map((service) => {
          const active = service.name === selected;
          return (
            <li key={service.id}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelected(service.name)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-md border px-4 py-3 text-left transition-colors',
                  active
                    ? 'border-ink ring-ink ring-1'
                    : 'border-line hover:border-charcoal-400',
                )}
              >
                <span className="min-w-0">
                  <span className="type-body-s block truncate font-semibold">
                    {service.name}
                  </span>
                  {service.detail ? (
                    <span className="type-caption text-muted block truncate">
                      {service.detail}
                    </span>
                  ) : null}
                </span>
                <span className="type-body-s shrink-0 font-semibold">
                  R{rand.format(service.fromPrice)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <ButtonLink
        href={`/book/${slug}?service=${encodeURIComponent(selected)}`}
        size="lg"
        className="mt-4 w-full"
      >
        Book {current?.name.toLowerCase()}
      </ButtonLink>
      <p className="type-caption text-muted mt-3 text-center">
        You will not be charged yet.
      </p>
    </div>
  );
}
