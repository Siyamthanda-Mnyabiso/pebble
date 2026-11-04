'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { rescheduleBooking } from '@/app/account/actions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatDay } from '@/lib/dates';

export type RescheduleDay = { iso: string; times: string[] };

/** Pick a new open date and time. Only the provider's free slots are offered. */
export function RescheduleForm({
  bookingId,
  days,
  confirmed,
}: {
  bookingId: string;
  days: RescheduleDay[];
  /** A confirmed booking goes back to pending until the provider agrees. */
  confirmed: boolean;
}) {
  const router = useRouter();
  const open = days.filter((d) => d.times.length > 0);
  const [show, setShow] = useState(false);
  const [date, setDate] = useState(open[0]?.iso ?? '');
  const [time, setTime] = useState(open[0]?.times[0] ?? '');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const times = open.find((d) => d.iso === date)?.times ?? [];

  if (open.length === 0) {
    return (
      <p className="type-body-s text-muted">
        There are no free times in the next two weeks. Check back soon.
      </p>
    );
  }

  if (!show) {
    return (
      <Button variant="secondary" onClick={() => setShow(true)}>
        Reschedule
      </Button>
    );
  }

  return (
    <form
      className="bg-subtle max-w-[520px] rounded-lg p-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError('');
        startTransition(async () => {
          const result = await rescheduleBooking(bookingId, date, time);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setShow(false);
          router.refresh();
        });
      }}
    >
      <h3 className="type-h4">Choose a new time</h3>
      {confirmed ? (
        <p className="type-body-s text-muted mt-1">
          Your provider will need to confirm the new time.
        </p>
      ) : null}

      <label className="mt-4 block">
        <span className="type-body-s mb-2 block font-semibold">Date</span>
        <select
          value={date}
          onChange={(event) => {
            const next = event.target.value;
            setDate(next);
            setTime(open.find((d) => d.iso === next)?.times[0] ?? '');
          }}
          className="border-line-strong bg-page type-body-s h-12 w-full rounded-md border px-4"
        >
          {open.map((d) => (
            <option key={d.iso} value={d.iso}>
              {formatDay(d.iso)}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="mt-4">
        <legend className="type-body-s mb-2 font-semibold">Start time</legend>
        <div className="flex flex-wrap gap-2">
          {times.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={time === t}
              onClick={() => setTime(t)}
              className={cn(
                'type-body-s h-10 rounded-full border px-4 font-semibold transition-colors',
                time === t
                  ? 'bg-dark text-on-dark border-transparent'
                  : 'border-line-strong bg-page hover:bg-subtle',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="type-body-s text-danger mt-4">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex gap-3">
        <Button type="submit" disabled={pending || !time}>
          {pending ? 'Saving…' : 'Confirm new time'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => setShow(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
