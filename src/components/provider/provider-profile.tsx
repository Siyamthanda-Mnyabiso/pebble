import Image from 'next/image';
import Link from 'next/link';
import { SaveButton } from '@/components/account/save-button';
import { Icon } from '@/components/icons';
import { ArrowBadge } from '@/components/ui/button';
import type { Provider } from '@/data/providers';
import { AvailabilityPicker } from './availability-picker';
import { ServicePicker } from './service-picker';
import { ShareButton } from './share-button';

const rand = new Intl.NumberFormat('en-ZA');

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'work', label: 'Work' },
  { id: 'pricing', label: 'Pricing' },
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
        <Icon key={i} name="starFilled" size={16} />
      ))}
    </span>
  );
}

export function ProviderProfile({
  provider,
  saved = false,
}: {
  provider: Provider;
  saved?: boolean;
}) {
  const thumbs = provider.gallery.slice(1, 4);
  const extra = provider.gallery.length - 4;

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pt-2 pb-24 md:px-8 lg:px-16">
      <Link
        href="/explore"
        className="type-body-s inline-flex items-center gap-2 py-3 font-semibold"
      >
        <Icon name="skipBack" size={16} />
        Back
      </Link>

      <section
        id="overview"
        className="mt-4 grid scroll-mt-24 gap-8 lg:grid-cols-2 lg:gap-12"
      >
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
            <Image
              src={provider.image}
              alt={`${provider.name}`}
              fill
              priority
              sizes="(min-width: 1024px) 560px, 100vw"
              className="object-cover"
            />
          </div>
          {thumbs.length > 0 ? (
            <ul
              className={`mt-3 grid gap-3 ${extra > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}
            >
              {thumbs.map((src) => (
                <li
                  key={src}
                  className="relative aspect-[4/3] overflow-hidden rounded-md"
                >
                  <Image src={src} alt="" fill sizes="140px" className="object-cover" />
                </li>
              ))}
              {extra > 0 ? (
                <li className="bg-dark text-on-dark type-h3 flex aspect-[4/3] items-center justify-center rounded-md">
                  +{extra}
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="type-h1">{provider.name}</h1>
            {provider.verified ? (
              <Icon name="verified" size={28} label="Verified provider" />
            ) : null}
          </div>
          <p className="type-body-l text-muted mt-3">{provider.tagline}</p>
          <p className="type-body-s mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="starFilled" size={14} />
              {provider.rating.toFixed(1)} ({provider.reviewCount} reviews)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="pin" size={16} />
              {provider.area} · {provider.distanceKm} km away
            </span>
          </p>
          <p className="type-body mt-5 max-w-[560px]">{provider.about}</p>

          <ServicePicker slug={provider.slug} services={provider.services}>
            <SaveButton
              slug={provider.slug}
              name={provider.name}
              initialSaved={saved}
              size={22}
              className="shadow-card size-[52px]"
            />
            <ShareButton name={provider.name} />
          </ServicePicker>
        </div>
      </section>

      <nav
        aria-label="Profile sections"
        className="border-line bg-page sticky top-0 z-10 mt-12 flex gap-8 overflow-x-auto border-b"
      >
        {tabs.map((tab) => (
          <a
            key={tab.id}
            href={`#${tab.id}`}
            className="type-body-s hover:text-muted py-4 font-semibold whitespace-nowrap"
          >
            {tab.label}
            {tab.id === 'reviews' ? ` (${provider.reviewCount})` : ''}
          </a>
        ))}
      </nav>

      <section id="pricing" className="scroll-mt-16 pt-12">
        <h2 className="type-h2">Services and pricing</h2>
        <p className="type-body-s text-muted mt-2">
          Clear starting prices. Your final quote is confirmed before the job starts.
        </p>
        <ul className="mt-6 flex flex-col gap-4">
          {provider.services.map((service) => (
            <li
              key={service.name}
              className="bg-page shadow-card relative flex items-center justify-between gap-4 rounded-lg px-6 py-5"
            >
              <div>
                <h3 className="type-h4">
                  <Link
                    href={`/book/${provider.slug}?service=${encodeURIComponent(service.name)}`}
                    className="after:absolute after:inset-0"
                  >
                    {service.name}
                  </Link>
                </h3>
                <p className="type-caption text-muted mt-1">{service.detail}</p>
              </div>
              <div className="flex items-center gap-4">
                <p className="type-body-s font-semibold whitespace-nowrap">
                  From R{rand.format(service.fromPrice)}
                </p>
                <ArrowBadge size={40} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section id="work" className="scroll-mt-16 pt-14">
        <h2 className="type-h2">Recent work</h2>
        <p className="type-body-s text-muted mt-2">A few jobs from the last month.</p>
        <ul className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {provider.work.map((src) => (
            <li key={src} className="relative aspect-[4/3] overflow-hidden rounded-lg">
              <Image
                src={src}
                alt={`Recent work by ${provider.name}`}
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="object-cover"
              />
            </li>
          ))}
        </ul>
      </section>

      <section id="availability" className="scroll-mt-16 pt-14">
        <h2 className="type-h2">Availability</h2>
        <p className="type-body-s text-muted mt-2">{provider.replyTime}</p>
        <div className="mt-6">
          <AvailabilityPicker days={provider.availability} />
        </div>
      </section>

      <section id="reviews" className="scroll-mt-16 pt-14">
        <h2 className="type-h2">Reviews</h2>
        <div className="mt-4 flex items-center gap-4">
          <p className="type-stat">{provider.rating.toFixed(1)}</p>
          <div>
            <Stars value={provider.rating} />
            <p className="type-caption text-muted mt-1">
              Based on {provider.reviewCount} reviews
            </p>
          </div>
        </div>
        <ul className="mt-6 grid gap-6 md:grid-cols-3">
          {provider.reviews.map((review, i) => (
            <li
              key={`${review.name}-${i}`}
              className="bg-page shadow-card rounded-lg p-6"
            >
              <Stars value={review.rating} />
              {review.quote ? <p className="type-body mt-4">{review.quote}</p> : null}
              <div className="mt-5 flex items-center gap-3">
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
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
