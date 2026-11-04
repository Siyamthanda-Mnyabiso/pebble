import Image from 'next/image';
import { Icon } from '@/components/icons';
import { ArrowButton } from '@/components/ui/button';

/** The hero photo is cropped to the Pebble "blob" (path from the Figma design). */
function HeroPhoto() {
  return (
    <div className="relative mx-auto aspect-[552/520] w-full max-w-[600px] lg:mx-0 lg:ml-auto">
      <svg width="0" height="0" aria-hidden="true" className="absolute">
        <defs>
          <clipPath id="hero-blob" clipPathUnits="objectBoundingBox">
            <path
              transform="scale(0.0018102 0.0019223)"
              d="M300 0.24C450 -5.76 560 100.24 552 260.24C546 420.24 440 520.24 290 520.24C170 520.24 90 470.24 0 440.24C40 330.24 -10 190.24 70 90.24C130 20.24 210 4.24 300 0.24Z"
            />
          </clipPath>
        </defs>
      </svg>
      <Image
        src="/images/hero-woman.jpg"
        alt="A smiling provider enjoying the afternoon sun"
        fill
        priority
        sizes="(min-width: 1024px) 600px, 100vw"
        className="object-cover"
        style={{ clipPath: 'url(#hero-blob)' }}
      />
      <Icon
        name="sparkles"
        size={64}
        className="text-ink absolute top-2 left-0 lg:top-8"
        aria-hidden="true"
      />
    </div>
  );
}

function SearchBar() {
  return (
    <form
      action="/explore"
      role="search"
      className="bg-page shadow-card flex h-[72px] w-full max-w-[620px] items-center gap-3.5 rounded-full py-0 pr-2.5 pl-6"
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
      <label className="hidden items-center gap-2 sm:flex">
        <Icon name="pin" size={20} className="text-muted" />
        <span className="sr-only">Area</span>
        <input
          name="area"
          defaultValue="Cape Town"
          className="type-body-s w-24 bg-transparent font-semibold outline-none"
        />
      </label>
      <ArrowButton size={52} label="Search" type="submit" />
    </form>
  );
}

export function Hero() {
  return (
    <section className="mx-auto max-w-[1440px] px-4 py-6 md:px-8 lg:px-16">
      <div className="grid items-center gap-10 lg:grid-cols-[680px_1fr] lg:gap-8">
        <div className="flex flex-col gap-6 lg:py-16">
          <h1 className="type-display max-w-[420px] lg:max-w-[480px]">
            Get it done, without the hassle.
          </h1>
          <p className="type-body-l text-muted max-w-[340px]">
            Find trusted people for home, lifestyle and everyday services.
          </p>
          <div className="lg:pt-2">
            <SearchBar />
          </div>
        </div>
        <HeroPhoto />
      </div>
    </section>
  );
}
