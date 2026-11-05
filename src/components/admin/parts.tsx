import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="bg-page shadow-card rounded-xl p-5">
      <p className="type-h2">{value}</p>
      <p className="type-body-s text-muted">{label}</p>
      {hint ? <p className="type-caption text-muted mt-1">{hint}</p> : null}
    </div>
  );
}

export function Stats({ children }: { children: ReactNode }) {
  return <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

const tone = {
  // Status chips stay neutral: the label says what it is, colour does not.
  green: 'bg-subtle text-ink',
  grey: 'bg-subtle text-muted',
  red: 'bg-subtle text-ink',
  blue: 'bg-subtle text-ink',
} as const;

export function Pill({
  tone: t,
  children,
}: {
  tone: keyof typeof tone;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'type-caption inline-flex h-7 items-center rounded-full px-3 font-semibold capitalize',
        tone[t],
      )}
    >
      {children}
    </span>
  );
}

/** A table that scrolls sideways on narrow screens instead of breaking the page. */
export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="bg-page shadow-card mt-6 overflow-x-auto rounded-xl">
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="border-line border-b">
            {head.map((h) => (
              <th key={h} className="type-caption text-muted px-5 py-3.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-line divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export function Cell({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <td className={cn('type-body-s px-5 py-4 align-middle', className)}>{children}</td>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="type-body-s text-muted bg-subtle mt-6 rounded-lg px-5 py-10 text-center">
      {children}
    </p>
  );
}

/** Area chart of a daily series. Drawn in SVG so it needs no library. */
export function DailyChart({ points }: { points: { day: string; n: number }[] }) {
  const w = 600;
  const h = 180;
  const pad = 8;
  const peak = Math.max(0, ...points.map((p) => p.n));
  const max = Math.max(1, peak);
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
  const y = (n: number) => h - pad - (n / max) * (h - pad * 2);
  const line = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.n).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${x(points.length - 1)} ${h - pad} L${x(0)} ${h - pad} Z`;
  const total = points.reduce((sum, p) => sum + p.n, 0);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`${total} bookings in the last 30 days, up to ${peak} a day`}
        className="h-auto w-full"
      >
        <path d={area} className="fill-subtle" />
        <path
          d={line}
          fill="none"
          strokeWidth={2.5}
          strokeLinejoin="round"
          className="stroke-ink"
        />
      </svg>
      <figcaption className="type-caption text-muted mt-2 flex justify-between">
        <span>{points[0]?.day}</span>
        <span>Peak {peak} a day</span>
        <span>{points.at(-1)?.day}</span>
      </figcaption>
    </figure>
  );
}
