'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { signOut } from '@/app/(auth)/actions';
import { Logo } from '@/components/brand/logo';
import { Icon, type IconName } from '@/components/icons';
import { cn } from '@/lib/cn';

export type NavItem = { href: string; label: string; icon: IconName };

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

export function AccountSidebar({
  name,
  role,
  items,
  label = 'Account',
}: {
  name: string;
  role: string;
  items: NavItem[];
  label?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href);
  const current = items.find((item) => isActive(item.href));

  return (
    <aside className="border-line relative md:sticky md:top-0 md:h-dvh md:w-[280px] md:shrink-0 md:border-r">
      <div className="flex flex-col gap-4 px-4 pt-5 pb-3 md:gap-8 md:px-6 md:pt-6">
        <div className="flex h-11 items-center justify-between gap-3 md:block md:h-auto">
          <Logo />
          <div className="flex min-w-0 items-center gap-3 md:hidden">
            {current ? (
              <span className="type-body-s truncate font-semibold">{current.label}</span>
            ) : null}
            <button
              type="button"
              aria-expanded={open}
              aria-controls="account-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((value) => !value)}
              className="bg-subtle inline-flex size-11 shrink-0 items-center justify-center rounded-full"
            >
              <Icon name={open ? 'close' : 'menu'} size={22} />
            </button>
          </div>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <span className="bg-dark text-on-dark type-label inline-flex size-11 items-center justify-center rounded-full">
            {initials(name)}
          </span>
          <div className="min-w-0">
            <p className="type-body-s truncate font-semibold">{name || 'Your account'}</p>
            <p className="type-caption text-muted capitalize">{role}</p>
          </div>
        </div>
        <div
          id="account-menu"
          className={cn(
            'bg-page shadow-raised border-line absolute inset-x-0 top-full z-20 flex-col gap-4 border-t px-4 pt-3 pb-5 md:static md:z-auto md:flex md:gap-8 md:border-0 md:bg-transparent md:p-0 md:shadow-none',
            open ? 'flex' : 'hidden',
          )}
        >
          <nav aria-label={label} className="flex flex-col gap-1">
            {items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
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
          <div className="border-line mt-1 flex flex-col gap-1 border-t pt-2 md:border-0 md:pt-0">
            <Link
              href="/help"
              onClick={() => setOpen(false)}
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
      </div>
    </aside>
  );
}
