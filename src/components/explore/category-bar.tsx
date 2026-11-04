import Link from 'next/link';
import { Icon } from '@/components/icons';
import { serviceCategories } from '@/data/home';
import { cn } from '@/lib/cn';

/** Category chips that stay under the header while the results scroll. */
export function CategoryBar({ current, q }: { current?: string; q?: string }) {
  const href = (slug?: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (slug) params.set('category', slug);
    const query = params.toString();
    return query ? `/explore?${query}` : '/explore';
  };

  return (
    <nav
      aria-label="Service categories"
      className="bg-page border-line sticky top-0 z-20 border-b"
    >
      <ul className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-4 md:px-8 lg:px-16">
        {[
          { slug: undefined, label: 'All', icon: 'sparkles' as const },
          ...serviceCategories,
        ].map((c) => {
          const active = (c.slug ?? undefined) === (current || undefined);
          return (
            <li key={c.slug ?? 'all'} className="shrink-0">
              <Link
                href={href(c.slug)}
                scroll={false}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'type-caption flex flex-col items-center gap-1.5 border-b-2 px-3 pt-3 pb-2.5 font-semibold transition-colors',
                  active
                    ? 'border-ink text-ink'
                    : 'text-muted hover:text-ink border-transparent',
                )}
              >
                <Icon name={c.icon} size={22} />
                {c.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
