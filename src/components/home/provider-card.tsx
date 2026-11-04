import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { SaveButton } from '@/components/account/save-button';
import type { Provider } from '@/data/providers';

const rand = new Intl.NumberFormat('en-ZA');

export type CardProvider = Pick<
  Provider,
  'slug' | 'name' | 'rating' | 'reviewCount' | 'fromPrice' | 'image'
> &
  Partial<Pick<Provider, 'area' | 'city' | 'tagline'>>;

/** Photo first, text underneath, no box: the whole card is one link. */
export function ProviderCard({
  provider,
  saved = false,
}: {
  provider: CardProvider;
  saved?: boolean;
}) {
  return (
    <article className="group relative">
      <div className="bg-subtle relative aspect-[4/3] overflow-hidden rounded-lg">
        <Image
          src={provider.image}
          alt=""
          fill
          sizes="(min-width: 1500px) 280px, (min-width: 1024px) 24vw, (min-width: 640px) 45vw, 100vw"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <SaveButton
          slug={provider.slug}
          name={provider.name}
          initialSaved={saved}
          className="absolute top-2.5 right-2.5 z-10 size-9"
        />
      </div>
      <div className="mt-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="type-h4 min-w-0 truncate">
            <Link
              href={`/providers/${provider.slug}`}
              className="after:absolute after:inset-0"
            >
              {provider.name}
            </Link>
          </h3>
          {provider.reviewCount > 0 ? (
            <p className="type-body-s flex shrink-0 items-center gap-1">
              <Icon name="starFilled" size={13} />
              {provider.rating.toFixed(1)}
            </p>
          ) : null}
        </div>
        {provider.tagline || provider.city ? (
          <p className="type-body-s text-muted mt-0.5 truncate">
            {provider.tagline || provider.city}
          </p>
        ) : null}
        <p className="type-body-s mt-1">
          <span className="font-semibold">From R{rand.format(provider.fromPrice)}</span>
          {provider.reviewCount > 0 ? (
            <span className="text-muted"> · {provider.reviewCount} reviews</span>
          ) : null}
        </p>
      </div>
    </article>
  );
}
