import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { ArrowBadge } from '@/components/ui/button';
import type { ProviderSummary } from '@/data/home';

const rand = new Intl.NumberFormat('en-ZA');

export function ProviderCard({ provider }: { provider: ProviderSummary }) {
  return (
    <article className="bg-page shadow-card relative overflow-hidden rounded-lg">
      <div className="relative h-44">
        <Image
          src={provider.image}
          alt=""
          fill
          sizes="(min-width: 1024px) 310px, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
        <button
          type="button"
          aria-label={`Save ${provider.name}`}
          className="bg-page shadow-float absolute top-3 right-3 z-10 inline-flex size-10 items-center justify-center rounded-full"
        >
          <Icon name="heart" size={20} />
        </button>
      </div>
      <div className="flex flex-col gap-2 p-5">
        <h3 className="type-h4">
          <Link
            href={`/providers/${provider.slug}`}
            className="after:absolute after:inset-0"
          >
            {provider.name}
          </Link>
        </h3>
        <p className="type-body-s text-muted flex items-center gap-1.5">
          <Icon name="starFilled" size={14} className="text-ink" />
          <span>
            {provider.rating.toFixed(1)} ({provider.reviewCount})
          </span>
        </p>
        <div className="mt-1 flex items-center justify-between">
          <p className="type-body font-semibold">
            From R{rand.format(provider.fromPrice)}
          </p>
          <ArrowBadge size={40} />
        </div>
      </div>
    </article>
  );
}
