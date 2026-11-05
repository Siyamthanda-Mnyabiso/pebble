'use client';

import { useState, useTransition } from 'react';
import { replyToDispute, reportIssue, setBookingStatus } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/button';

export type DisputeView = {
  id: string;
  reason: string;
  details: string;
  provider_reply: string | null;
  status: 'open' | 'resolved';
  decision: 'release_payout' | 'refund_customer' | 'split' | null;
  decision_note: string | null;
  refund_cents: number | null;
  created_at: string;
};

export const REASON_LABEL: Record<string, string> = {
  not_done: 'The job was not done',
  poor_quality: 'The work was poor',
  no_show: 'Nobody came',
  other: 'Something else',
};

export const DECISION_LABEL: Record<NonNullable<DisputeView['decision']>, string> = {
  release_payout: 'The provider is paid',
  refund_customer: 'Refund to the customer',
  split: 'Part refund',
};

/** The customer confirms a finished job, or reports a problem and holds the payment. */
export function ConfirmOrReport({
  bookingId,
  confirmBy,
}: {
  bookingId: string;
  confirmBy: string | null;
}) {
  const [mode, setMode] = useState<'ask' | 'report'>('ask');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError('');
    startTransition(async () => {
      const result = await setBookingStatus(bookingId, 'confirm_done');
      if (!result.ok) setError(result.error);
    });
  }

  function report(formData: FormData) {
    setError('');
    startTransition(async () => {
      const result = await reportIssue(
        bookingId,
        String(formData.get('reason') ?? ''),
        String(formData.get('details') ?? ''),
      );
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="border-line-strong w-full rounded-xl border p-5">
      <p className="type-h4">Is the job done?</p>
      <p className="type-body-s text-muted mt-1">
        Your provider marked it finished.{' '}
        {confirmBy
          ? `If you do nothing, it is confirmed on ${new Intl.DateTimeFormat('en-ZA', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Africa/Johannesburg',
            }).format(new Date(confirmBy))}.`
          : ''}{' '}
        If something is wrong, tell us and the provider is not paid until we look into it.
      </p>
      {mode === 'ask' ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={confirm} disabled={pending}>
            {pending ? 'Please wait…' : 'Yes, the job is done'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setMode('report')}
            disabled={pending}
          >
            Report a problem
          </Button>
        </div>
      ) : (
        <form action={report} className="mt-4 flex flex-col gap-4">
          <label className="block">
            <span className="type-body-s mb-2 block font-semibold">What went wrong?</span>
            <select
              name="reason"
              required
              defaultValue=""
              className="border-line-strong bg-page type-body-s h-[52px] w-full rounded-md border px-4"
            >
              <option value="" disabled>
                Choose one
              </option>
              {Object.entries(REASON_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="type-body-s mb-2 block font-semibold">
              Tell us what happened
            </span>
            <textarea
              name="details"
              required
              minLength={10}
              maxLength={2000}
              rows={4}
              className="border-line-strong bg-page type-body-s w-full rounded-md border px-4 py-3"
            />
          </label>
          <div className="flex gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? 'Sending…' : 'Send report'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMode('ask')}
              disabled={pending}
            >
              Back
            </Button>
          </div>
        </form>
      )}
      {error ? (
        <p role="alert" className="type-caption text-danger mt-3">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** What was reported, what the provider said and what Pebble decided. Shown to both people. */
export function DisputeSummary({
  dispute,
  viewer,
}: {
  dispute: DisputeView;
  viewer: 'customer' | 'provider';
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  return (
    <section className="border-line-strong w-full rounded-xl border p-5">
      <p className="type-h4">
        {dispute.status === 'open' ? 'A problem was reported' : 'Problem looked into'}
      </p>
      <p className="type-body-s text-muted mt-1">
        {dispute.status === 'open'
          ? 'A person at Pebble is reviewing the messages and details. The provider is not paid while this is open.'
          : 'Pebble has made a decision.'}
      </p>
      <dl className="type-body-s mt-4 flex flex-col gap-3">
        <div>
          <dt className="text-muted">
            Reported · {REASON_LABEL[dispute.reason] ?? dispute.reason}
          </dt>
          <dd className="mt-0.5">{dispute.details}</dd>
        </div>
        {dispute.provider_reply ? (
          <div>
            <dt className="text-muted">Provider reply</dt>
            <dd className="mt-0.5">{dispute.provider_reply}</dd>
          </div>
        ) : null}
        {dispute.decision ? (
          <div>
            <dt className="text-muted">Decision · {DECISION_LABEL[dispute.decision]}</dt>
            <dd className="mt-0.5">{dispute.decision_note}</dd>
          </div>
        ) : null}
      </dl>
      {viewer === 'provider' && dispute.status === 'open' && !dispute.provider_reply ? (
        <form
          className="mt-4 flex flex-col gap-3"
          action={() => {
            setError('');
            startTransition(async () => {
              const result = await replyToDispute(dispute.id, text);
              if (!result.ok) setError(result.error);
            });
          }}
        >
          <label className="block">
            <span className="type-body-s mb-2 block font-semibold">Your reply</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
              minLength={5}
              maxLength={2000}
              rows={4}
              className="border-line-strong bg-page type-body-s w-full rounded-md border px-4 py-3"
            />
          </label>
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? 'Sending…' : 'Send reply'}
            </Button>
          </div>
          {error ? (
            <p role="alert" className="type-caption text-danger">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
