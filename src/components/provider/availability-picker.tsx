'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { AvailabilityDay } from '@/data/providers';

export function AvailabilityPicker({ days: allDays }: { days: AvailabilityDay[] }) {
  const days = allDays.slice(0, 7);
  const firstOpen = Math.max(
    0,
    days.findIndex((d) => d.slots > 0),
  );
  const [selected, setSelected] = useState(firstOpen);

  return (
    <ul className="grid grid-cols-4 gap-3 sm:grid-cols-7">
      {days.map((day, index) => {
        const off = day.slots === 0;
        const active = index === selected;
        return (
          <li key={day.iso}>
            <button
              type="button"
              disabled={off}
              aria-pressed={active}
              onClick={() => setSelected(index)}
              className={cn(
                'shadow-card flex w-full flex-col items-center gap-0.5 rounded-lg px-2 py-4 transition-colors',
                active ? 'bg-dark text-on-dark' : 'bg-page hover:bg-subtle',
                off && 'text-faint hover:bg-page',
              )}
            >
              <span className="type-caption">{day.day}</span>
              <span className="type-h3">{day.date}</span>
              <span className="type-caption">
                {off ? 'Off' : `${day.slots} ${day.slots === 1 ? 'slot' : 'slots'}`}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
