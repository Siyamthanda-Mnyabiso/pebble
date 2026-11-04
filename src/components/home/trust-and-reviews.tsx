import Image from 'next/image';
import { Icon } from '@/components/icons';
import { reviews, trustStats } from '@/data/home';
import { SectionHeader } from './section-header';

export function TrustAndReviews() {
  return (
    <section aria-labelledby="loved" className="bg-subtle">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-12 px-4 py-10 md:px-8 lg:gap-8 lg:px-16 lg:py-14">
        <dl className="grid gap-8 md:grid-cols-3 md:gap-6">
          {trustStats.map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse gap-1">
              <dd className="type-body-l text-muted">{stat.label}</dd>
              <dt className="type-stat">{stat.value}</dt>
            </div>
          ))}
        </dl>

        <SectionHeader id="loved" title="Loved by homes across the Cape" />

        <ul className="grid gap-6 md:grid-cols-3">
          {reviews.map((review) => (
            <li key={review.name} className="bg-page shadow-card rounded-lg p-6">
              <figure className="flex h-full flex-col gap-4">
                <div className="flex gap-1" role="img" aria-label="5 out of 5 stars">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Icon key={index} name="starFilled" size={18} />
                  ))}
                </div>
                <blockquote className="type-body flex-1">{review.quote}</blockquote>
                <figcaption className="flex items-center gap-3">
                  <Image
                    src={review.avatar}
                    alt=""
                    width={40}
                    height={40}
                    className="size-10 rounded-full object-cover"
                  />
                  <span className="flex flex-col">
                    <span className="type-body-s font-semibold">{review.name}</span>
                    <span className="type-caption text-muted">
                      {review.service} · {review.date}
                    </span>
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
