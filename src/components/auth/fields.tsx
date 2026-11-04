'use client';

import type { ComponentProps } from 'react';
import { useFormStatus } from 'react-dom';
import { Icon } from '@/components/icons';
import { cn } from '@/lib/cn';

export function TextField({
  label,
  hint,
  className,
  ...props
}: ComponentProps<'input'> & { label: string; hint?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="type-body-s mb-2 block font-semibold">{label}</span>
      <input
        {...props}
        className="border-line-strong bg-page placeholder:text-faint focus:border-ink type-body-s h-[52px] w-full rounded-md border px-4 transition-colors outline-none"
      />
      {hint ? <span className="type-caption text-muted mt-1.5 block">{hint}</span> : null}
    </label>
  );
}

export function SubmitButton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-dark text-on-dark hover:bg-hover disabled:bg-subtle disabled:text-disabled type-label flex h-[52px] w-full items-center justify-between rounded-full pr-5 pl-7 transition-colors"
    >
      {pending ? 'Please wait…' : children}
      <Icon name="skip" size={20} />
    </button>
  );
}

export function FormMessage({ error, notice }: { error?: string; notice?: string }) {
  if (!error && !notice) return null;
  return (
    <p
      role={error ? 'alert' : 'status'}
      className={cn(
        'type-body-s rounded-md px-4 py-3',
        error ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success',
      )}
    >
      {error ?? notice}
    </p>
  );
}
