import Image from 'next/image';
import Link from 'next/link';
import { SaveButton } from '@/components/account/save-button';
import { Icon } from '@/components/icons';
import type { Provider } from '@/data/providers';
import { PhotoGallery } from './photo-gallery';
import { AvailabilityPicker } from './availability-picker';
import { BookingCard } from './service-picker';
import { ShareButton } from './share-button';

const rand = new Intl.NumberFormat('en-ZA');

const tabs = [
  { id: 'services', label: 'Services' },
  { id: 'work', label: 'Work' },
  { id: 'availability', label: 'Availability' },
  { id: 'reviews', label: 'Reviews' },
];

function Stars({ value }: { value: number }) {
  const count = Math.max(1, Math.min(5, Math.round(value)));
  return (
    <span
      className="inline-flex gap-0.5"
      role="img"
      aria-label={`${value} out of 5 stars`}
    >
      {Array.from({ length: count }, (_, i) => (
        <Icon key={i} name="starFilled" size={14} />
      ))}
    </span>
  );
}

/** Every photo of the provider, main photo first, without repeats. */
function allPhotos(provider: Provider) {
  return [...new Set([provider.image, ...provider.gallery, ...provider.work])];
}

export function ProviderProfile({
  provider,
  saved = false,
}: {
  provider: Provider;
  saved?: boolean;
}) {
  // Work photos the mosaic already shows are not repeated further down.
  const shown = new Set(allPhotos(provider).slice(0, 5));
  const recentWork = [...new Set(provider.work)].filter((src) => !shown.has(src));
  const visibleTabs = tabs.filter((tab) => tab.id !== 'work' || recentWork.length > 0);

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 pt-4 pb-20 md:px-8 lg:px-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/explore"
            className="type-body-s text-muted hover:text-ink inline-flex items-center gap-1.5 py-1 font-semibold"
          >
            <Icon name="skipBack" size={14} />
            All providers
          </Link>
          <h1 className="type-h1 mt-1 flex items-center gap-2">
            {provider.name}
            {provider.verified ? (
              <Icon name="verified" size={22} label="Verified provider" />
            ) : null}
          </h1>
          <p className="type-body-s mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {provider.reviewCount > 0 ? (
              <span className="inline-flex items-center gap-1 font-semibold">
                <Icon name="starFilled" size={13} />
                {provider.rating.toFixed(1)}
                <span className="text-muted font-normal">({provider.reviewCount})</span>
              </span>
            ) : null}
            <span className="text-muted inline-flex items-center gap-1">
              <Icon name="pin" size={14} />
              {provider.area && provider.area !== provider.city
                ? `${provider.area}, ${provider.city}`
                : provider.city}
            </span>
            {provider.tagline ? (
              <span className="text-muted">{provider.tagline}</span>
            ) : null}
          </p>
        </div>
        <div className="flex gap-2">
          <ShareButton name={provider.name} />
          <SaveButton
            slug={provider.slug}
            name={provider.name}
            initialSaved={saved}
            size={18}
            className="bg-subtle size-10 shadow-none"
          />
        </div>
      </div>

      <div className="mt-4">
        <PhotoGallery photos={allPhotos(provider)} name={provider.name} />
      </div>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
        <aside className="lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:self-start">
          <BookingCard
            slug={provider.slug}
            services={provider.services}
            rating={provider.rating}
            reviewCount={provider.reviewCount}
          />
        </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <section id="overview" className="scroll-mt-24">
            <p className="type-body max-w-[640px]">{provider.about}</p>
            <p className="type-body-s text-muted mt-3">{provider.replyTime}</p>
          </section>

          <nav
            aria-label="Profile sections"
            className="border-line bg-page sticky top-0 z-10 mt-8 flex gap-6 overflow-x-auto border-b"
          >
            {visibleTabs.map((tab) => (
              <a
                key={tab.id}
                href={`#${tab.id}`}
                className="type-body-s hover:text-muted py-3.5 font-semibold whitespace-nowrap"
              >
                {tab.label}
                {tab.id === 'reviews' && provider.reviewCount > 0
                  ? ` (${provider.reviewCount})`
                  : ''}
              </a>
            ))}
          </nav>

          <section id="services" className="scroll-mt-16 pt-8">
            <h2 className="type-h2">Services and pricing</h2>
            <p className="type-body-s text-muted mt-1">
              Starting prices. Your final quote is confirmed before the job starts.
            </p>
            <ul className="divide-line mt-4 divide-y">
              {provider.services.map((service) => (
                <li
                  key={service.id}
                  className="relative flex items-center justify-between gap-4 py-4"
                >
                  <div className="min-w-0">
                    <h3 className="type-h4">
                      <Link
                        href={`/book/${provider.slug}?service=${encodeURIComponent(service.name)}`}
                        className="after:absolute after:inset-0 hover:underline"
                      >
                        {service.name}
                      </Link>
                    </h3>
                    {service.detail ? (
                      <p className="type-body-s text-muted mt-0.5">{service.detail}</p>
                    ) : null}
                  </div>
                  <p className="type-body-s shrink-0 font-semibold whitespace-nowrap">
                    From R{rand.format(service.fromPrice)}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {recentWork.length > 0 ? (
            <section id="work" className="border-line mt-8 scroll-mt-16 border-t pt-8">
              <h2 className="type-h2">Recent work</h2>
              <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {recentWork.map((src) => (
                  <li
                    key={src}
                    className="relative aspect-[4/3] overflow-hidden rounded-md"
                  >
                    <Image
                      src={src}
                      alt={`Recent work by ${provider.name}`}
                      fill
                      sizes="(min-width: 1024px) 220px, 45vw"
                      className="object-cover"
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section
            id="availability"
            className="border-line mt-8 scroll-mt-16 border-t pt-8"
          >
            <h2 className="type-h2">Availability</h2>
            <div className="mt-4">
              <AvailabilityPicker days={provider.availability} />
            </div>
          </section>

          <section id="reviews" className="border-line mt-8 scroll-mt-16 border-t pt-8">
            <h2 className="type-h2 flex items-center gap-2">
              <Icon name="starFilled" size={18} />
              {provider.reviewCount > 0
                ? `${provider.rating.toFixed(1)} · ${provider.reviewCount} reviews`
                : 'No reviews yet'}
            </h2>
            <ul className="mt-6 grid gap-x-10 gap-y-8 md:grid-cols-2">
              {provider.reviews.map((review, i) => (
                <li key={`${review.name}-${i}`}>
                  <div className="flex items-center gap-3">
                    {review.avatar ? (
                      <Image
                        src={review.avatar}
                        alt=""
                        width={40}
                        height={40}
                        className="size-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="bg-subtle type-label inline-flex size-10 items-center justify-center rounded-full">
                        {review.name[0]}
                      </span>
                    )}
                    <div>
                      <p className="type-body-s font-semibold">{review.name}</p>
                      <p className="type-caption text-muted">
                        {review.service} · {review.date}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Stars value={review.rating} />
                  </div>
                  {review.quote ? (
                    <p className="type-body mt-1.5">{review.quote}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
