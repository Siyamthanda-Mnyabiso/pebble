'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  approveProvider,
  rejectProvider,
  reinstateProvider,
  requestChanges,
  setCheck,
  suspendProvider,
  type DecisionResult,
} from '@/app/admin/provider-actions';
import { Button } from '@/components/ui/button';

export function VettingChecklist({
  slug,
  items,
  locked,
}: {
  slug: string;
  items: { field: string; label: string; checked: boolean; hint: string }[];
  locked: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  return (
    <div>
      <ul className="divide-line divide-y">
        {items.map((item) => (
          <li key={item.field} className="py-3">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={item.checked}
                disabled={locked || pending}
                className="mt-1 size-5 accent-black"
                onChange={(e) =>
                  start(async () => {
                    setError('');
                    const result = await setCheck(slug, item.field, e.target.checked);
                    if (!result.ok) setError(result.error ?? 'That did not work.');
                    router.refresh();
                  })
                }
              />
              <span>
                <span className="type-body-s block font-semibold">{item.label}</span>
                <span className="type-caption text-muted block">{item.hint}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="type-body-s text-danger mt-3">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function DecisionPanel({
  slug,
  status,
  blockers,
}: {
  slug: string;
  status: string;
  blockers: string[];
}) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<string | null>(null);

  function run(key: string, action: () => Promise<DecisionResult>) {
    if (confirm !== key) {
      setConfirm(key);
      return;
    }
    setConfirm(null);
    start(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.ok) {
        setNote('');
        router.refresh();
      }
    });
  }

  const noteOk = note.trim().length >= 5;
  const label = (key: string, text: string) =>
    confirm === key ? `Confirm: ${text.toLowerCase()}` : text;

  return (
    <div className="flex flex-col gap-4">
      {status === 'pending_review' ? (
        <>
          <div>
            <Button
              disabled={blockers.length > 0 || pending}
              onClick={() => run('approve', () => approveProvider(slug))}
            >
              {label('approve', 'Approve and publish')}
            </Button>
            {blockers.length > 0 ? (
              <div className="type-body-s text-muted mt-3" id="blockers">
                <p className="font-semibold">
                  Approval stays locked until these are done:
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="type-body-s text-muted mt-3">Every check has passed.</p>
            )}
          </div>

          <label className="block">
            <span className="type-body-s mb-2 block font-semibold">
              Note to the provider (needed to request changes or reject)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Say exactly what is missing or wrong."
              className="border-line-strong bg-page type-body-s w-full rounded-md border p-4"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              disabled={!noteOk || pending}
              onClick={() => run('changes', () => requestChanges(slug, note))}
            >
              {label('changes', 'Request changes')}
            </Button>
            <Button
              variant="secondary"
              disabled={!noteOk || pending}
              onClick={() => run('reject', () => rejectProvider(slug, note))}
            >
              {label('reject', 'Reject')}
            </Button>
          </div>
        </>
      ) : null}

      {status === 'approved' ? (
        <>
          <label className="block">
            <span className="type-body-s mb-2 block font-semibold">
              Reason for suspending
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              className="border-line-strong bg-page type-body-s w-full rounded-md border p-4"
            />
          </label>
          <div>
            <Button
              variant="secondary"
              disabled={!noteOk || pending}
              onClick={() => run('suspend', () => suspendProvider(slug, note))}
            >
              {label('suspend', 'Suspend provider')}
            </Button>
          </div>
        </>
      ) : null}

      {status === 'suspended' ? (
        <div>
          <Button
            disabled={pending}
            onClick={() => run('reinstate', () => reinstateProvider(slug))}
          >
            {label('reinstate', 'Reinstate provider')}
          </Button>
        </div>
      ) : null}

      {status === 'draft' || status === 'changes_requested' || status === 'rejected' ? (
        <p className="type-body-s text-muted">
          {status === 'draft'
            ? 'This provider has not submitted yet.'
            : status === 'changes_requested'
              ? 'Waiting for the provider to resubmit.'
              : 'This listing was rejected.'}
        </p>
      ) : null}

      {result ? (
        <p
          role={result.ok ? 'status' : 'alert'}
          className={`type-body-s ${result.ok ? '' : 'text-danger'}`}
        >
          {result.ok ? result.notice : result.error}
        </p>
      ) : null}
    </div>
  );
}
