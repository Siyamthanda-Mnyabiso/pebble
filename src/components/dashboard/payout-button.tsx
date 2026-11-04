'use client';

import { useState, useTransition } from 'react';
import { requestPayout } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/button';

export function PayoutButton({ disabled }: { disabled: boolean }) {
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <Button
        disabled={disabled || pending}
        onClick={() =>
          startTransition(async () => {
            setError('');
            const result = await requestPayout();
            if (!result.ok) setError(result.error);
          })
        }
      >
        {pending ? 'Requesting…' : 'Request payout'}
      </Button>
      {error ? (
        <p role="alert" className="type-caption text-danger mt-2">
          {error}
        </p>
      ) : null}
    </div>
  );
}
