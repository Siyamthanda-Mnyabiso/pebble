import { LocationPicker } from '@/components/location/location-picker';
import { Icon } from '@/components/icons';
import { ArrowButton } from '@/components/ui/button';

function SearchBar() {
  return (
    <form
      action="/explore"
      role="search"
      className="bg-page shadow-card flex h-14 w-full max-w-[760px] items-center gap-3 rounded-full py-0 pr-2 pl-5 lg:h-[72px] lg:pr-2.5 lg:pl-6"
    >
      <Icon name="search" size={22} />
      <label className="min-w-0 flex-1">
        <span className="sr-only">What do you need help with?</span>
        <input
          name="q"
          type="search"
          placeholder="What do you need help with?"
          className="type-body-s sm:type-body placeholder:text-faint w-full bg-transparent outline-none"
        />
      </label>
      <span className="bg-line hidden h-8 w-px sm:block" aria-hidden="true" />
      <LocationPicker className="hidden sm:inline-flex" />
      <ArrowButton size={40} label="Search" type="submit" />
    </form>
  );
}

export function Hero() {
  return (
    <section className="mx-auto max-w-[1440px] px-4 pt-8 pb-6 md:px-8 lg:px-16 lg:pt-[72px] lg:pb-12">
      <div className="flex flex-col items-center gap-4 text-center lg:gap-5">
        <h1 className="max-w-[900px] text-[34px] leading-[38px] font-extrabold tracking-[-1px] lg:text-[64px] lg:leading-[68px] lg:tracking-[-2px]">
          Get it done, without the hassle.
        </h1>
        <p className="type-body-l text-muted max-w-[700px]">
          Find trusted people for home, lifestyle and everyday services.
        </p>
        <div className="flex w-full justify-center pt-2">
          <SearchBar />
        </div>
      </div>
    </section>
  );
}
