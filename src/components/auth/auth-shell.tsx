import Image from 'next/image';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';

/** Split-screen frame shared by sign in, sign up and password reset. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <main className="flex items-center justify-center px-4 py-10 md:px-8">
        <div className="w-full max-w-[400px]">
          <Logo />
          {children}
        </div>
      </main>
      <aside className="relative hidden p-5 lg:block" aria-hidden="true">
        <div className="relative size-full overflow-hidden rounded-xl">
          <Image
            src="/images/hero-woman.jpg"
            alt=""
            fill
            priority
            sizes="50vw"
            className="object-cover"
          />
          <div className="bg-page shadow-raised absolute right-8 bottom-8 left-8 rounded-lg p-6">
            <p className="type-h4">Trusted pros, a few taps away</p>
            <p className="type-body-s text-muted mt-2">
              Book cleaners, plumbers, gardeners and more across Cape Town. Real reviews,
              honest prices in Rand.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
