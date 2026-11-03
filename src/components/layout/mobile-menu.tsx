'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/icons';
import { ButtonLink } from '@/components/ui/button';

export function MobileMenu({ links }: { links: { label: string; href: string }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="ml-auto lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((value) => !value)}
        className="bg-subtle inline-flex size-11 items-center justify-center rounded-full"
      >
        <Icon name={open ? 'close' : 'menu'} size={22} />
      </button>

      {open ? (
        <div
          id="mobile-menu"
          className="border-line bg-page shadow-raised absolute inset-x-0 top-[72px] z-20 border-t px-4 pt-4 pb-6"
        >
          <nav aria-label="Mobile" className="flex flex-col">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="type-h4 border-line border-b py-4"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-5 flex gap-3">
            <ButtonLink href="/sign-in" variant="secondary" className="flex-1">
              Log in
            </ButtonLink>
            <ButtonLink href="/sign-up" className="flex-1">
              Sign up
            </ButtonLink>
          </div>
        </div>
      ) : null}
    </div>
  );
}
