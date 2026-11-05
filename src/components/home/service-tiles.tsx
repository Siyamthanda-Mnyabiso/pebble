import Link from 'next/link';
import { Icon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { listCategories } from '@/data/categories';
import { SectionHeader } from './section-header';

export async function ServiceTiles() {
  const categories = await listCategories();
  if (categories.length === 0) return null;
  return (
    <section
      aria-labelledby="popular-services"
      className="mx-auto max-w-[1440px] px-4 pt-2 pb-8 md:px-8 lg:px-16 lg:pb-10"
    >
      <SectionHeader
        id="popular-services"
        title="Popular services"
        linkLabel="View all"
        href="/explore"
      />
      <ul className="border-line -mx-4 mt-4 flex gap-2 overflow-x-auto border-b px-4 md:-mx-8 md:px-8 lg:mx-0 lg:gap-4 lg:px-0">
        {categories.map((category) => (
          <li key={category.slug} className="shrink-0 lg:flex-1">
            <Link
              href={`/explore?category=${category.slug}`}
              className={cn(
                'text-muted hover:text-ink hover:border-line-strong flex h-[76px] min-w-[84px] flex-col items-center justify-center gap-1.5 border-b-2 border-transparent transition-colors lg:w-full',
              )}
            >
              <Icon name={category.icon} size={24} />
              <span className="type-caption font-semibold">{category.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
