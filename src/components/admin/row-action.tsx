'use client';

import { useState, useTransition } from 'react';
import type { AdminResult } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';

/** A button that runs a server action and shows a failure next to it. */
export function RowAction({
  label,
  action,
  variant = 'primary',
  confirm,
}: {
  label: string;
  action: () => Promise<AdminResult>;
  variant?: 'primary' | 'secondary';
  /** Ask for a second tap before running. */
  confirm?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [asking, setAsking] = useState(false);

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        size="sm"
        variant={variant}
        disabled={pending}
        onClick={() => {
          if (confirm && !asking) {
            setAsking(true);
            return;
          }
          setError('');
          startTransition(async () => {
            const result = await action();
            if (!result.ok) setError(result.error);
            setAsking(false);
          });
        }}
      >
        {pending ? 'Saving…' : asking ? `Confirm ${label.toLowerCase()}` : label}
      </Button>
      {error ? (
        <span role="alert" className="type-caption text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
