'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import {
  requestPasswordReset,
  signIn,
  signUp,
  type AuthState,
} from '@/app/(auth)/actions';
import { cn } from '@/lib/cn';
import { FormMessage, SubmitButton, TextField } from './fields';

const initial: AuthState = {};

export function SignInForm({ next, linkError }: { next: string; linkError: boolean }) {
  const [state, action] = useActionState(signIn, initial);
  const error =
    state.error ?? (linkError ? 'That link has expired. Please sign in.' : undefined);

  return (
    <>
      <h1 className="type-h1 mt-8">Welcome back</h1>
      <p className="type-body-s text-muted mt-2">
        Sign in to manage your bookings and saved providers.
      </p>
      <form action={action} className="mt-7 flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.fields?.email}
          placeholder="you@email.com"
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Your password"
        />
        <Link
          href="/forgot-password"
          className="type-caption -mt-1 self-end font-semibold underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>
        <FormMessage error={error} />
        <SubmitButton>Sign in</SubmitButton>
      </form>
      <p className="type-body-s text-muted mt-6 text-center">
        New to Pebble?{' '}
        <Link
          href={`/sign-up?next=${encodeURIComponent(next)}`}
          className="text-ink font-semibold"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}

export function SignUpForm({
  next,
  initialRole = 'customer',
}: {
  next: string;
  initialRole?: 'customer' | 'provider';
}) {
  const [state, action] = useActionState(signUp, initial);
  const [role, setRole] = useState<'customer' | 'provider'>(
    state.fields?.role
      ? state.fields.role === 'provider'
        ? 'provider'
        : 'customer'
      : initialRole,
  );

  if (state.notice) {
    return (
      <>
        <h1 className="type-h1 mt-8">Check your email</h1>
        <p className="type-body text-muted mt-3">{state.notice}</p>
        <p className="type-body-s text-muted mt-6">
          Already confirmed?{' '}
          <Link href="/sign-in" className="text-ink font-semibold">
            Sign in
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="type-h1 mt-8">Create your account</h1>
      <p className="type-body-s text-muted mt-2">
        Join Pebble to book trusted local service providers.
      </p>
      <form action={action} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="role" value={role} />
        <div
          role="radiogroup"
          aria-label="I am here to"
          className="bg-subtle grid grid-cols-2 rounded-full p-1"
        >
          {(
            [
              ['customer', 'I need a service'],
              ['provider', 'I offer a service'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={role === value}
              onClick={() => setRole(value)}
              className={cn(
                'type-body-s h-11 rounded-full font-semibold transition-colors',
                role === value ? 'bg-dark text-on-dark' : 'text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <TextField
          label="Full name"
          name="full_name"
          autoComplete="name"
          required
          defaultValue={state.fields?.full_name}
          placeholder="Thandi Nkosi"
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.fields?.email}
          placeholder="you@email.com"
        />
        <TextField
          label="Mobile number"
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={state.fields?.phone}
          placeholder="+27 82 555 0148"
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          hint="At least 8 characters"
        />
        <p className="type-caption text-muted">
          By creating an account you agree to the{' '}
          <Link href="/terms" className="underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
        <FormMessage error={state.error} />
        <SubmitButton>Create account</SubmitButton>
      </form>
      <p className="type-body-s text-muted mt-6 text-center">
        Already have an account?{' '}
        <Link
          href={`/sign-in?next=${encodeURIComponent(next)}`}
          className="text-ink font-semibold"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, initial);

  return (
    <>
      <h1 className="type-h1 mt-8">Reset your password</h1>
      <p className="type-body-s text-muted mt-2">
        Enter your email and we will send you a link to choose a new password.
      </p>
      <form action={action} className="mt-7 flex flex-col gap-4">
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.fields?.email}
          placeholder="you@email.com"
        />
        <FormMessage error={state.error} notice={state.notice} />
        <SubmitButton>Send reset link</SubmitButton>
      </form>
      <p className="type-body-s text-muted mt-6 text-center">
        <Link href="/sign-in" className="text-ink font-semibold">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
