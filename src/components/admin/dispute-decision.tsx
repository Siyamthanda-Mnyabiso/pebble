'use client';

import { useState, useTransition } from 'react';
import { decideDispute } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatRand } from '@/lib/money';

const OPTIONS = [
  { value: 'release_payout', title: 'Release payout', body: 'Provider is paid' },
  { value: 'refund_customer', title: 'Refund customer', body: 'Money goes back' },
  { value: 'split', title: 'Split', body: 'Part to each' },
] as const;

/** The admin's decision. It records the outcome and tells both people. No money moves from here. */
export function DisputeDecision({ id, priceCents }: { id: string; priceCents: number }) {
  const [decision, setDecision] =
    useState<(typeof OPTIONS)[number]['value']>('release_payout');
  const [note, setNote] = useState('');
  const [refund, setRefund] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function submit() {
    setError('');
    startTransition(async () => {
      const result = await decideDispute(id, decision, note, Number(refund));
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      <fieldset>
        <legend className="type-body-s mb-2 font-semibold">Your decision</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {OPTIONS.map((o) => (
            <label key={o.value} className="cursor-pointer">
              <input
                type="radio"
                name="decision"
                value={o.value}
                checked={decision === o.value}
                onChange={() => setDecision(o.value)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'border-line-strong flex flex-col gap-0.5 rounded-lg border p-4',
                  'peer-checked:bg-dark peer-checked:text-on-dark peer-checked:border-transparent',
                  'peer-focus-visible:outline-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2',
                )}
              >
                <span className="type-body-s font-semibold">{o.title}</span>
                <span className="type-caption opacity-75">{o.body}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {decision === 'split' ? (
        <label className="block">
          <span className="type-body-s mb-2 block font-semibold">
            Refund to the customer (R, less than {formatRand(priceCents)})
          </span>
          <input
            type="number"
            min={1}
            max={Math.floor(priceCents / 100) - 1}
            step={1}
            required
            value={refund}
            onChange={(e) => setRefund(e.target.value)}
            className="border-line-strong bg-page type-body-s h-[52px] w-full rounded-md border px-4"
          />
        </label>
      ) : null}
      <label className="block">
        <span className="type-body-s mb-2 block font-semibold">Note to both people</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          required
          minLength={5}
          maxLength={500}
          placeholder="Explain the decision in a sentence or two"
          className="border-line-strong bg-page type-body-s h-[52px] w-full rounded-md border px-4"
        />
      </label>
      {error ? (
        <p role="alert" className="type-caption text-danger">
          {error}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Record decision'}
        </Button>
      </div>
      <p className="type-caption text-muted">
        Both people are told, and the decision is saved in the booking history. Nothing is
        paid or refunded from here until a payment gateway is connected. A disputed payout
        is never released automatically.
      </p>
    </form>
  );
}
