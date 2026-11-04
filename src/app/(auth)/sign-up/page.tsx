import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignUpForm } from '@/components/auth/auth-forms';
import { safeNext } from '@/lib/auth';

export const metadata: Metadata = { title: 'Create account' };

export default function SignUpPage({ searchParams }: PageProps<'/sign-up'>) {
  return (
    <Suspense>
      {searchParams.then((params) => (
        <SignUpForm
          next={safeNext(typeof params.next === 'string' ? params.next : null)}
        />
      ))}
    </Suspense>
  );
}
