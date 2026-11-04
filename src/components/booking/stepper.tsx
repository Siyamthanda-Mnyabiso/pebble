import { cn } from '@/lib/cn';

const steps = ['Details', 'Review', 'Confirm'];

export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol aria-label="Booking progress" className="flex items-center justify-center gap-3">
      {steps.map((label, index) => {
        const number = index + 1;
        const reached = number <= current;
        return (
          <li
            key={label}
            aria-current={number === current ? 'step' : undefined}
            className="flex items-center gap-3"
          >
            {index > 0 ? (
              <span className="bg-line h-px w-8 sm:w-[72px]" aria-hidden="true" />
            ) : null}
            <span
              className={cn(
                'type-caption inline-flex size-8 items-center justify-center rounded-full border font-semibold',
                reached
                  ? 'bg-dark text-on-dark border-transparent'
                  : 'border-line-strong text-muted',
              )}
            >
              {number}
            </span>
            <span
              className={cn(
                'type-body-s hidden font-semibold sm:inline',
                reached ? 'text-ink' : 'text-muted',
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
