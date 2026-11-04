import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { Icon } from '@/components/icons';
import { primaryLinks } from '@/components/layout/site-nav';
import { MobileMenu } from '@/components/layout/mobile-menu';
import { ButtonLink } from '@/components/ui/button';

/** Compact header for search pages: the search box lives in the bar itself. */
export function ExploreHeader({ q, area }: { q?: string; area: string }) {
  return (
    <header className="bg-page relative">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-4 px-4 md:px-8 lg:h-[88px] lg:gap-8 lg:px-16">
        <Logo />

        <form
          action="/explore"
          role="search"
          className="bg-page shadow-card flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full pr-3 pl-5 lg:max-w-[460px] lg:flex-none lg:basis-[460px]"
        >
          <Icon name="search" size={20} />
          <label className="min-w-0 flex-1">
            <span className="sr-only">What do you need help with?</span>
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="What do you need help with?"
              className="type-body-s placeholder:text-faint w-full bg-transparent outline-none"
            />
          </label>
          <button type="submit" className="sr-only">
            Search
          </button>
        </form>

        <div className="border-line-strong hidden h-12 items-center gap-2 rounded-full border px-5 lg:flex">
          <Icon name="pin" size={18} />
          <span className="type-body-s font-semibold">{area}</span>
        </div>

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
