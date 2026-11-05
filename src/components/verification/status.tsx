import { Icon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { STATUS_META, type VerificationStatus } from '@/lib/verification';

const tone = {
  grey: 'bg-subtle text-muted',
  blue: 'bg-subtle text-muted',
  green: 'bg-subtle text-muted',
  red: 'bg-subtle text-muted',
} as const;

export function StatusBadge({ status }: { status: VerificationStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        'type-caption inline-flex h-7 items-center rounded-full px-3 font-semibold',
        tone[meta.tone],
      )}
    >
      {meta.label}
    </span>
  );
}

const STEPS = ['Draft', 'Submitted', 'Under review', 'Approved'] as const;

/** Which step a status sits on, and whether that step ended badly. */
function position(status: VerificationStatus) {
  switch (status) {
    case 'draft':
      return { at: 0, bad: false };
    case 'changes_requested':
      return { at: 0, bad: true };
    case 'pending_review':
      return { at: 2, bad: false };
    case 'rejected':
      return { at: 2, bad: true };
    case 'approved':
      return { at: 3, bad: false };
    case 'suspended':
      return { at: 3, bad: true };
  }
}

export function ProgressTracker({ status }: { status: VerificationStatus }) {
  const { at, bad } = position(status);
  return (
    <ol className="flex items-start" aria-label="Verification progress">
      {STEPS.map((step, i) => {
        const done = i < at || (status === 'approved' && i === at);
        const current = i === at;
        return (
          <li
            key={step}
            className="flex flex-1 flex-col items-center gap-2 text-center first:items-start last:items-end"
          >
            <span className="flex w-full items-center">
              <span
                className={cn(
                  'inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2',
                  done && 'bg-dark text-on-dark border-transparent',
                  current && !done && !bad && 'border-ink',
                  current && bad && 'border-[#b3261e] text-[#b3261e]',
                  !done && !current && 'border-line text-muted',
                )}
                aria-current={current ? 'step' : undefined}
              >
                {done ? (
                  <Icon name="check" size={14} />
                ) : bad && current ? (
                  <Icon name="close" size={14} />
                ) : (
                  <span className="type-caption font-semibold">{i + 1}</span>
                )}
              </span>
              {i < STEPS.length - 1 ? (
                <span
                  className={cn('mx-1 h-0.5 flex-1', i < at ? 'bg-ink' : 'bg-line')}
                  aria-hidden
                />
              ) : null}
            </span>
            <span
              className={cn('type-caption', current ? 'font-semibold' : 'text-muted')}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
