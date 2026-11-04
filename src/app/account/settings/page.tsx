import type { Metadata } from 'next';
import { Suspense } from 'react';
import { signOut } from '@/app/(auth)/actions';
import { PasswordForm, ProfileForm } from '@/components/account/settings-forms';
import { PageHeading } from '@/components/account/ui';
import { getProfile, requireUser } from '@/lib/auth';
import { formatMonthYear } from '@/lib/dates';

export const metadata: Metadata = { title: 'Profile and settings' };

export default function SettingsPage() {
  return (
    <>
      <PageHeading
        title="Profile and settings"
        subtitle="Keep your details up to date so providers can reach you."
      />
      <Suspense fallback={<div className="bg-subtle mt-8 h-96 rounded-lg" aria-hidden />}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  const user = await requireUser('/account/settings');
  const profile = await getProfile(user.id);
  if (!profile) {
    return <p className="type-body text-muted mt-8">We could not load your profile.</p>;
  }

  return (
    <div className="mt-8">
      <p className="type-body-s text-muted mb-4">
        Member since {formatMonthYear(profile.created_at)}
      </p>
      <ProfileForm profile={profile} email={user.email ?? ''} />
      <PasswordForm />
      <form action={signOut} className="mt-6">
        <button
          type="submit"
          className="type-body-s border-line-strong hover:bg-subtle h-12 rounded-full border-[1.5px] px-6 font-semibold"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
