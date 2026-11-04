'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useRef, useState, useTransition } from 'react';
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
import { ADMIN_CHECKS } from '@/lib/verification-meta';

type ChecksValue = {
  checks: Record<string, boolean>;
  toggle: (field: string, value: boolean) => void;
  error: string;
  /** Resolves once every tick has been saved. */
  flush: () => Promise<void>;
};

const ChecksContext = createContext<ChecksValue | null>(null);

function useChecks() {
  const value = useContext(ChecksContext);
  if (!value) throw new Error('Checklist components must sit inside ChecksProvider');
  return value;
}

/**
 * Holds the checklist in the browser so a tick shows instantly and the approval
 * button reacts at once. The save runs in the background and the tick is undone
 * if it fails. The database still decides whether approval is allowed.
 */
export function ChecksProvider({
  slug,
  initial,
  children,
}: {
  slug: string;
  initial: Record<string, boolean>;
  children: React.ReactNode;
}) {
  const [checks, setChecks] = useState(initial);
  const [error, setError] = useState('');
  // Saves run one after another so the database sees the ticks in order.
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  function toggle(field: string, value: boolean) {
    setError('');
    setChecks((current) => ({ ...current, [field]: value }));
    queue.current = queue.current.then(async () => {
      const result = await setCheck(slug, field, value);
      if (!result.ok) {
        setChecks((current) => ({ ...current, [field]: !value }));
        setError(result.error ?? 'That did not save. Please try again.');
      }
    });
  }

  const flush = async () => {
    await queue.current;
  };

  return (
    <ChecksContext.Provider value={{ checks, toggle, error, flush }}>
      {children}
    </ChecksContext.Provider>
  );
}

export function VettingChecklist({
  items,
  locked,
}: {
  items: { field: string; label: string; hint: string }[];
  locked: boolean;
}) {
  const { checks, toggle, error } = useChecks();

  return (
    <div>
      <ul className="divide-line divide-y">
        {items.map((item) => (
          <li key={item.field} className="py-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={checks[item.field] ?? false}
                disabled={locked}
                className="mt-1 size-5 accent-black"
                onChange={(e) => toggle(item.field, e.target.checked)}
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
  providerBlockers,
}: {
  slug: string;
  status: string;
  /** What the provider still has to supply. The checklist below is added live. */
  providerBlockers: string[];
}) {
  const { checks, flush } = useChecks();
  const blockers = [
    ...providerBlockers,
    ...ADMIN_CHECKS.filter((c) => !checks[c.field]).map((c) => c.label),
  ];
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
      await flush();
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
