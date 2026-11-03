import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { footerColumns } from '@/data/home';

export function SiteFooter() {
  return (
    <footer className="border-line bg-page border-t">
      <div className="mx-auto max-w-[1440px] px-4 pt-12 pb-10 md:px-8 lg:px-16 lg:pt-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_repeat(4,auto)] lg:gap-16">
          <div className="max-w-60">
            <Logo />
            <p className="type-body-s text-muted mt-4">
              Trusted people for home, lifestyle and everyday services.
            </p>
          </div>

          {footerColumns.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="type-body-s font-semibold">{column.heading}</h2>
              <ul className="mt-4 flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.label}>
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

        <div className="type-caption text-muted mt-12 flex flex-col gap-3 md:flex-row md:justify-between">
          <p>© 2026 Pebble Marketplace (Pty) Ltd</p>
          <ul className="flex gap-6">
            <li>
              <Link href="/privacy" className="hover:text-ink">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-ink">
                Terms
              </Link>
            </li>
            <li>
              <Link href="/sitemap" className="hover:text-ink">
                Sitemap
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
