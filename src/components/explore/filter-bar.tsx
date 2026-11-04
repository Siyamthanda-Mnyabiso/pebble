'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Icon } from '@/components/icons';
import { cn } from '@/lib/cn';

type Panel = 'rating' | 'price' | 'availability' | 'sort' | null;

const sortOptions = [
  { value: '', label: 'Recommended' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
];

const chip =
  'type-body-s shadow-card inline-flex h-11 items-center gap-2 rounded-full px-5 font-semibold transition-colors';

export function FilterBar({ total }: { total: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState<Panel>(null);
  const [pending, startTransition] = useTransition();

  const rating = params.get('minRating') ?? '';
  const minPrice = params.get('min') ?? '';
  const maxPrice = params.get('max') ?? '';
  const availability = params.get('avail') ?? '';
  const sort = params.get('sort') ?? '';
  const [priceDraft, setPriceDraft] = useState({ min: minPrice, max: maxPrice });

  const anyFilter = Boolean(rating || minPrice || maxPrice || availability);

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete('limit');
    startTransition(() => router.push(`/explore?${next.toString()}`, { scroll: false }));
    setOpen(null);
  }

  function toggle(panel: Exclude<Panel, null>) {
    setOpen((current) => (current === panel ? null : panel));
  }

  const trigger = (panel: Exclude<Panel, null>, label: string, active: boolean) => (
    <button
      type="button"
      aria-expanded={open === panel}
      aria-haspopup="true"
      onClick={() => toggle(panel)}
      className={cn(
        chip,
        'bg-page',
        (open === panel || active) && 'ring-line-strong ring-[1.5px]',
      )}
    >
      {label}
      <Icon name="chevronDown" size={14} />
    </button>
  );

  const option = (selected: boolean, label: string, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className={cn(
        'type-body-s flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left font-semibold',
        selected ? 'bg-subtle' : 'hover:bg-subtle',
      )}
    >
      {label}
      {selected ? <Icon name="check" size={16} /> : null}
    </button>
  );

  return (
    <div className={cn('relative', pending && 'opacity-70')} aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setPriceDraft({ min: '', max: '' });
            update({ minRating: '', min: '', max: '', avail: '' });
          }}
          aria-pressed={!anyFilter}
          className={cn(chip, !anyFilter ? 'bg-dark text-on-dark' : 'bg-page')}
        >
          All
        </button>
        {trigger('rating', rating ? `${rating}+ stars` : 'Rating', Boolean(rating))}
        {trigger(
          'price',
          minPrice || maxPrice ? `R${minPrice || 0} to R${maxPrice || 'any'}` : 'Price',
          Boolean(minPrice || maxPrice),
        )}
        {trigger(
          'availability',
          availability === 'today' ? 'Available today' : 'Availability',
          Boolean(availability),
        )}
        <div className="ml-auto flex items-center gap-4">
          <p className="type-body-s text-muted hidden sm:block" aria-live="polite">
            {total} {total === 1 ? 'provider' : 'providers'}
          </p>
          <button
            type="button"
            aria-label="Sort"
            aria-expanded={open === 'sort'}
            onClick={() => toggle('sort')}
            className="bg-page shadow-card inline-flex size-11 items-center justify-center rounded-full"
          >
            <Icon name="menu" size={20} />
          </button>
        </div>
      </div>

      {open ? (
        <div
          className={cn(
            'bg-page shadow-raised absolute z-30 mt-3 rounded-lg p-3',
            open === 'sort' ? 'right-0 w-60' : 'left-0 w-[min(380px,100%)]',
            open === 'price' && 'p-5',
          )}
        >
          {open === 'rating' ? (
            <div role="menu">
              {option(!rating, 'Any rating', () => update({ minRating: '' }))}
              {option(rating === '4', '4.0 and up', () => update({ minRating: '4' }))}
              {option(rating === '4.5', '4.5 and up', () => update({ minRating: '4.5' }))}
            </div>
          ) : null}

          {open === 'availability' ? (
            <div role="menu">
              {option(!availability, 'Any time', () => update({ avail: '' }))}
              {option(availability === 'today', 'Available today', () =>
                update({ avail: 'today' }),
              )}
            </div>
          ) : null}

          {open === 'sort' ? (
            <div role="menu">
              {sortOptions.map((item) =>
                option(sort === item.value, item.label, () =>
                  update({ sort: item.value }),
                ),
              )}
            </div>
          ) : null}

          {open === 'price' ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                update({ min: priceDraft.min, max: priceDraft.max });
              }}
            >
              <h2 className="type-h4">Price range</h2>
              <p className="type-body-s text-muted mt-1">
                Typical starting price in rand
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {(['min', 'max'] as const).map((key) => (
                  <label
                    key={key}
                    className="border-line-strong block rounded-md border px-3 py-2"
                  >
                    <span className="type-caption text-muted block">
                      {key === 'min' ? 'Minimum' : 'Maximum'}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="type-body-s font-semibold">R</span>
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={priceDraft[key]}
                        onChange={(event) =>
                          setPriceDraft((draft) => ({
                            ...draft,
                            [key]: event.target.value.replace(/\D/g, ''),
                          }))
                        }
                        className="type-body-s w-full bg-transparent font-semibold outline-none"
                      />
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setPriceDraft({ min: '', max: '' });
                    update({ min: '', max: '' });
                  }}
                  className="type-body-s font-semibold underline-offset-4 hover:underline"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  className="bg-dark text-on-dark hover:bg-hover type-body-s h-11 rounded-full px-6 font-semibold"
                >
                  Apply
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
