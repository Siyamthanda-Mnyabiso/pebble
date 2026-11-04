'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from '@/app/(auth)/actions';
import { Logo } from '@/components/brand/logo';
import { Icon, type IconName } from '@/components/icons';
import { cn } from '@/lib/cn';

const items: { href: string; label: string; icon: IconName }[] = [
  { href: '/account/bookings', label: 'Bookings', icon: 'calendar' },
  { href: '/account/saved', label: 'Saved providers', icon: 'heart' },
  { href: '/account/reviews', label: 'Reviews', icon: 'star' },
  { href: '/account/settings', label: 'Profile and settings', icon: 'user' },
];

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('') || '?'
  );
}

export function AccountSidebar({ name, role }: { name: string; role: string }) {
  const pathname = usePathname();

  return (
    <aside className="border-line md:sticky md:top-0 md:h-dvh md:w-[280px] md:shrink-0 md:border-r">
      <div className="flex flex-col gap-4 px-4 pt-5 pb-3 md:gap-8 md:px-6 md:pt-6">
        <Logo />
        <div className="hidden items-center gap-3 md:flex">
          <span className="bg-dark text-on-dark type-label inline-flex size-11 items-center justify-center rounded-full">
            {initials(name)}
          </span>
          <div className="min-w-0">
            <p className="type-body-s truncate font-semibold">{name || 'Your account'}</p>
            <p className="type-caption text-muted capitalize">{role}</p>
          </div>
        </div>
        <nav
          aria-label="Account"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-col md:gap-1 md:overflow-visible md:px-0"
        >
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'type-body-s flex h-12 shrink-0 items-center gap-3 rounded-full px-4 font-semibold whitespace-nowrap transition-colors',
                  active ? 'bg-dark text-on-dark' : 'hover:bg-subtle',
                )}
              >
                <Icon name={item.icon} size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden flex-col gap-1 md:flex">
          <Link
            href="/help"
            className="type-body-s hover:bg-subtle flex h-12 items-center gap-3 rounded-full px-4 font-semibold"
          >
            <Icon name="info" size={20} />
            Help and support
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="type-body-s hover:bg-subtle flex h-12 w-full items-center gap-3 rounded-full px-4 text-left font-semibold"
            >
              <Icon name="skipBack" size={20} />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
