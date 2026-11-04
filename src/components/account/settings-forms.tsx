'use client';

import { useActionState } from 'react';
import { changePassword, updateProfile, type ProfileState } from '@/app/account/actions';
import { FormMessage, SubmitButton, TextField } from '@/components/auth/fields';
import type { Profile } from '@/lib/auth';

const initial: ProfileState = {};

function Toggle({
  name,
  title,
  body,
  defaultChecked,
}: {
  name: string;
  title: string;
  body: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="border-line flex cursor-pointer items-center justify-between gap-4 border-b py-4 last:border-b-0">
      <span>
        <span className="type-body-s block font-semibold">{title}</span>
        <span className="type-caption text-muted block">{body}</span>
      </span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="bg-line-strong peer-checked:bg-dark peer-focus-visible:outline-ink relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5"
      />
    </label>
  );
}

export function ProfileForm({ profile, email }: { profile: Profile; email: string }) {
  const [state, action] = useActionState(updateProfile, initial);

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="bg-page shadow-card flex flex-col gap-4 rounded-xl p-6">
        <TextField
          label="Full name"
          name="full_name"
          autoComplete="name"
          required
          defaultValue={profile.full_name}
        />
        <TextField label="Email" type="email" value={email} readOnly disabled />
        <TextField
          label="Mobile number"
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={profile.phone}
          placeholder="+27 82 555 0148"
        />
        <TextField
          label="Address"
          name="address"
          autoComplete="street-address"
          defaultValue={profile.address}
          placeholder="Street address, suburb"
        />
        <FormMessage
          error={state.error}
          notice={state.saved ? 'Your changes are saved.' : undefined}
        />
        <SubmitButton>Save changes</SubmitButton>
      </section>

      <section className="bg-page shadow-card h-fit rounded-xl p-6">
        <h2 className="type-h3">Settings</h2>
        <div className="mt-2">
          <Toggle
            name="notify_bookings"
            title="Booking updates"
            body="Email when a booking changes"
            defaultChecked={profile.notify_bookings}
          />
          <Toggle
            name="notify_reminders"
            title="Reminders"
            body="A reminder 24 hours before a job"
            defaultChecked={profile.notify_reminders}
          />
          <Toggle
            name="notify_offers"
            title="Offers and tips"
            body="Occasional news from Pebble"
            defaultChecked={profile.notify_offers}
          />
        </div>
        <p className="type-caption text-muted mt-3">
          Notification choices are saved now. Emails and reminders are not sent yet.
        </p>
      </section>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, initial);

  return (
    <form
      action={action}
      className="bg-page shadow-card mt-6 flex max-w-[420px] flex-col gap-4 rounded-xl p-6"
    >
      <h2 className="type-h3">Change password</h2>
      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        hint="At least 8 characters"
      />
      <FormMessage
        error={state.error}
        notice={state.saved ? 'Your password has been updated.' : undefined}
      />
      <SubmitButton>Update password</SubmitButton>
    </form>
  );
}
