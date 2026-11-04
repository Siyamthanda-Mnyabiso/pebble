import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteNav } from '@/components/layout/site-nav';
import { ButtonLink } from '@/components/ui/button';
import type { InfoContent } from '@/data/pages';

export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteNav />
      <main className="mx-auto w-full max-w-[860px] px-4 pt-10 pb-24 md:px-8 lg:pt-16">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}

export function PageHeading({ title, intro }: { title: string; intro: string }) {
  return (
    <header>
      <h1 className="type-h1">{title}</h1>
      <p className="type-body-l text-muted mt-4">{intro}</p>
    </header>
  );
}

export function InfoPage({ content }: { content: InfoContent }) {
  return (
    <PageFrame>
      <PageHeading title={content.title} intro={content.intro} />
      {content.draft ? (
        <p className="type-caption bg-subtle mt-6 rounded-lg px-4 py-3">
          Draft. This page is a preview and not yet final.
        </p>
      ) : null}
      {content.sections.map((section) => (
        <section key={section.heading} className="mt-12">
          <h2 className="type-h2">{section.heading}</h2>
          {section.body?.map((paragraph) => (
            <p key={paragraph} className="type-body mt-4">
              {paragraph}
            </p>
          ))}
          {section.items ? (
            <ul className="mt-6 flex flex-col gap-4">
              {section.items.map((item) => (
                <li key={item.title} className="bg-page shadow-card rounded-lg px-6 py-5">
                  <h3 className="type-h4">{item.title}</h3>
                  <p className="type-body-s text-muted mt-1">{item.text}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
      {content.cta ? (
        <ButtonLink href={content.cta.href} size="lg" arrow className="mt-12">
          {content.cta.label}
        </ButtonLink>
      ) : null}
    </PageFrame>
  );
}
