'use client';

import { useState } from 'react';
import { Icon, type IconName } from '@/components/icons';
import { ButtonLink } from '@/components/ui/button';
import type { ProviderService } from '@/data/providers';

const serviceIcons: IconName[] = ['home', 'sparkles', 'box'];

export function ServicePicker({
  slug,
  services,
  children,
}: {
  slug: string;
  services: ProviderService[];
  /** Extra actions (save, share) shown beside Book now. */
  children?: React.ReactNode;
}) {
  const [selected, setSelected] = useState(services[0]?.name ?? '');

  return (
    <>
      <ul className="mt-6 grid grid-cols-3 gap-3" role="radiogroup" aria-label="Service">
        {services.slice(0, 3).map((service, index) => {
          const active = service.name === selected;
          return (
            <li key={service.name}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelected(service.name)}
                className={`flex h-full w-full flex-col items-center gap-3 rounded-lg px-3 py-5 text-center transition-colors ${
                  active ? 'bg-dark text-on-dark' : 'bg-page shadow-card hover:bg-subtle'
                }`}
              >
                <Icon name={serviceIcons[index] ?? 'home'} size={26} />
                <span className="type-caption font-semibold">{service.name}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-center gap-3">
        <ButtonLink
          href={`/book/${slug}?service=${encodeURIComponent(selected)}`}
          size="lg"
          className="flex-1 justify-between pr-5"
        >
          Book {selected.toLowerCase()}
          <Icon name="skip" size={20} />
        </ButtonLink>
        {children}
      </div>
    </>
  );
}
