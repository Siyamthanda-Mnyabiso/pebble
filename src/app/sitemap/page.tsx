import type { Metadata } from 'next';
import Link from 'next/link';
import { PageFrame, PageHeading } from '@/components/layout/info-page';
import { sitemapGroups } from '@/data/pages';

export const metadata: Metadata = { title: 'Sitemap' };

export default function SitemapPage() {
  return (
    <PageFrame>
      <PageHeading title="Sitemap" intro="Every page on Pebble." />
      <div className="mt-12 grid gap-10 sm:grid-cols-2">
        {sitemapGroups.map((group) => (
          <nav key={group.heading} aria-label={group.heading}>
            <h2 className="type-h4">{group.heading}</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="type-body-s text-muted hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </PageFrame>
  );
}
