import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { ButtonLink } from '@/components/ui/button';
import { MobileMenu } from './mobile-menu';

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

        <div className="ml-auto hidden items-center gap-6 lg:flex">
          <Link href="/sign-in" className="type-body-s hover:text-muted font-semibold">
            Log in
          </Link>
          <ButtonLink href="/sign-up" size="sm">
            Sign up
          </ButtonLink>
        </div>

        <MobileMenu links={primaryLinks} />
      </div>
    </header>
  );
}
