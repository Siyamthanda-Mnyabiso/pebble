import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getProfile, requireUser } from '@/lib/auth';

export default function AccountPage() {
  return (
    <Suspense>
      <RoleRedirect />
    </Suspense>
  );
}

/** Providers land on their dashboard, customers on their bookings. */
async function RoleRedirect(): Promise<never> {
  const user = await requireUser('/account');
  const profile = await getProfile(user.id);
  redirect(profile?.role === 'provider' ? '/dashboard' : '/account/bookings');
}
