import Image from 'next/image';
import { ButtonLink } from '@/components/ui/button';

export function ProviderCta() {
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-16 md:px-8 lg:px-16 lg:pb-24">
      <div className="bg-dark text-on-dark grid overflow-hidden rounded-xl lg:grid-cols-[1fr_420px]">
        <div className="flex flex-col items-start justify-center gap-4 p-8 lg:py-16 lg:pl-16">
          <h2 className="type-h1">Run a service business?</h2>
          <p className="type-body-l text-on-dark/75 max-w-[780px]">
            List your services on Pebble, meet new customers and manage bookings in one
            place.
          </p>
          <ButtonLink
            href="/providers/join"
            variant="light"
            size="lg"
            arrow
            className="mt-2"
          >
            Become a provider
          </ButtonLink>
        </div>
        <div className="relative min-h-56 lg:min-h-[284px]">
          <Image
            src="/images/hero-painter.jpg"
            alt="A provider painting a living room wall"
            fill
            sizes="(min-width: 1024px) 420px, 100vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}
