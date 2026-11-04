import Link from 'next/link';
import { Icon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { serviceCategories } from '@/data/home';
import { SectionHeader } from './section-header';

export function ServiceTiles() {
  return (
    <section
      aria-labelledby="popular-services"
      className="mx-auto max-w-[1440px] px-4 pt-6 pb-12 md:px-8 lg:px-16 lg:pb-16"
    >
      <SectionHeader
        id="popular-services"
        title="Popular services"
        linkLabel="View all"
        href="/explore"
      />
      <ul className="-mx-4 mt-6 flex gap-4 overflow-x-auto px-4 pt-1 pb-6 md:-mx-8 md:px-8 lg:mx-0 lg:grid lg:grid-cols-8 lg:gap-5 lg:overflow-visible lg:px-0">
        {serviceCategories.map((category) => (
          <li key={category.slug} className="shrink-0 lg:shrink">
            <Link
              href={`/explore?category=${category.slug}`}
              className={cn(
                'bg-page shadow-card hover:bg-subtle flex h-[108px] w-[128px] flex-col items-center justify-center gap-3 rounded-lg transition-colors lg:w-full',
              )}
            >
              <Icon name={category.icon} size={28} />
              <span className="type-body-s font-semibold">{category.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
