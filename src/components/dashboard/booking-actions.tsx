'use client';

import { useState, useTransition } from 'react';
import { setBookingStatus } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/button';

type Action = {
  label: string;
  status: 'confirmed' | 'completed' | 'cancelled';
  danger?: boolean;
};

/** Buttons that change a booking's status. Cancelling asks for a second tap. */
export function BookingActions({
  bookingId,
  actions,
}: {
  bookingId: string;
  actions: Action[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  function run(status: Action['status']) {
    setError('');
    startTransition(async () => {
      const result = await setBookingStatus(bookingId, status);
      if (!result.ok) setError(result.error);
      setConfirming(null);
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {actions.map((action) => {
          if (action.danger && confirming === action.status) {
            return (
              <span key={action.status} className="flex gap-2">
                <Button size="sm" disabled={pending} onClick={() => run(action.status)}>
                  {pending ? 'Please wait…' : 'Yes, cancel'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setConfirming(null)}
                >
                  Keep it
                </Button>
              </span>
            );
          }
          return (
            <Button
              key={action.status}
              size="sm"
              variant={action.danger ? 'secondary' : 'primary'}
              disabled={pending}
              onClick={() =>
                action.danger ? setConfirming(action.status) : run(action.status)
              }
            >
              {action.label}
            </Button>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="type-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
