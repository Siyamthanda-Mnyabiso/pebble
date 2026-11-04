import { Logo } from '@/components/brand/logo';
import { LocationPicker } from '@/components/location/location-picker';
import { Icon } from '@/components/icons';
import { AuthActions } from '@/components/layout/site-nav';

/** Compact header for search pages: the search box lives in the bar itself. */
export function ExploreHeader({
  q,
  area,
  active,
}: {
  q?: string;
  area: string;
  active?: string[];
}) {
  return (
    <header className="bg-page relative">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 md:px-8 lg:h-[88px] lg:flex-nowrap lg:gap-8 lg:px-16 lg:py-0">
        <Logo />

        <form
          action="/explore"
          role="search"
          className="bg-page shadow-card order-last flex h-12 min-w-0 basis-full items-center gap-3 rounded-full pr-3 pl-5 lg:order-none lg:max-w-[460px] lg:flex-none lg:basis-[460px]"
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

        <LocationPicker
          city={area}
          active={active}
          className="border-line-strong h-12 rounded-full border px-5"
        />

        <AuthActions />
      </div>
    </header>
  );
}
