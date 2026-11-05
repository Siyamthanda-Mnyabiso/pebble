'use client';

import { useState, useTransition } from 'react';
import { setBookingStatus, type BookingMove } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/button';

type Action = {
  label: string;
  move: BookingMove;
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

  function run(move: BookingMove) {
    setError('');
    startTransition(async () => {
      const result = await setBookingStatus(bookingId, move);
      if (!result.ok) setError(result.error);
      setConfirming(null);
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {actions.map((action) => {
          if (action.danger && confirming === action.move) {
            return (
              <span key={action.move} className="flex gap-2">
                <Button size="sm" disabled={pending} onClick={() => run(action.move)}>
                  {pending
                    ? 'Please wait…'
                    : `Yes, ${action.move === 'decline' ? 'decline' : 'cancel'}`}
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
              key={action.move}
              size="sm"
              variant={action.danger ? 'secondary' : 'primary'}
              disabled={pending}
              onClick={() =>
                action.danger ? setConfirming(action.move) : run(action.move)
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
