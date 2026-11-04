import Link from 'next/link';
import { Suspense } from 'react';
import type { User } from '@supabase/supabase-js';
import { getUser } from '@/lib/auth';
import { Logo } from '@/components/brand/logo';
import { ButtonLink } from '@/components/ui/button';
import { MobileMenu } from './mobile-menu';

export function AuthActions() {
  return (
    <Suspense fallback={<NavActions user={null} />}>
      <SignedInNavActions />
    </Suspense>
  );
}

async function SignedInNavActions() {
  return <NavActions user={await getUser()} />;
}

function initialOf(user: User) {
  const name = (user.user_metadata?.full_name as string | undefined) || user.email || '?';
  return name.trim()[0]!.toUpperCase();
}

function NavActions({ user }: { user: User | null }) {
  return (
    <>
      <div className="ml-auto hidden items-center gap-6 lg:flex">
        {user ? (
          <>
            <Link
              href="/account/bookings"
              className="type-body-s hover:text-muted font-semibold"
            >
              Bookings
            </Link>
            <Link
              href="/account/settings"
              aria-label="Your account"
              className="bg-dark text-on-dark type-label inline-flex size-10 items-center justify-center rounded-full"
            >
              {initialOf(user)}
            </Link>
          </>
        ) : (
          <>
            <Link href="/sign-in" className="type-body-s hover:text-muted font-semibold">
              Log in
            </Link>
            <ButtonLink href="/sign-up" size="sm">
              Sign up
            </ButtonLink>
          </>
        )}
      </div>
      <MobileMenu links={primaryLinks} signedIn={Boolean(user)} />
    </>
  );
}

export const primaryLinks = [
  { label: 'Explore', href: '/explore' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'For providers', href: '/providers/join' },
];

export function SiteNav() {
  return (
    <header className="bg-page">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-10 px-4 md:px-8 lg:h-[88px] lg:px-16">
        <Logo />

        <nav aria-label="Primary" className="hidden items-center gap-10 lg:flex">
          {primaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="type-body-s hover:text-muted font-semibold"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <AuthActions />
      </div>
    </header>
  );
}
