import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignInForm } from '@/components/auth/auth-forms';
import { safeNext } from '@/lib/auth';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  return (
    <Suspense>
      {searchParams.then((params) => (
        <SignInForm
          next={safeNext(typeof params.next === 'string' ? params.next : null)}
          linkError={params.error === 'link'}
        />
      ))}
    </Suspense>
  );
}
