import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { StatusBadge } from '@/components/verification/status';
import { DecisionPanel, VettingChecklist } from '@/components/verification/admin-panels';
import { Icon } from '@/components/icons';
import { categoryLabel } from '@/data/providers';
import { requireAdmin } from '@/lib/admin';
import { formatRand } from '@/lib/money';
import { createClient } from '@/lib/supabase/server';
import {
  ADMIN_CHECKS,
  DOC_KINDS,
  EVENT_LABEL,
  loadVerification,
  NEEDS_CERTIFICATE,
} from '@/lib/verification';

export const metadata: Metadata = { title: 'Review provider' };

export default function Page({ params }: PageProps<'/admin/providers/[slug]'>) {
  return (
    <Suspense fallback={<div className="bg-subtle h-96 rounded-lg" aria-hidden />}>
      <Content params={params} />
    </Suspense>
  );
}

type Row = {
  slug: string;
  name: string;
  category: string;
  tagline: string;
  about: string;
  city: string;
  area: string;
  image: string;
  gallery: string[];
  work: string[];
  provider_services: { id: string; name: string; from_price: number }[];
};

const date = (iso: string) =>
  new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-page shadow-card mt-6 rounded-xl p-6">
      <h2 className="type-h3">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

async function Content({
  params,
}: {
  params: PageProps<'/admin/providers/[slug]'>['params'];
}) {
  const { slug } = await params;
  await requireAdmin(`/admin/providers/${slug}`);
  const supabase = await createClient();

  const { data: row } = await supabase
    .from('providers')
    .select(
      'slug, name, category, tagline, about, city, area, image, gallery, work, provider_services(id, name, from_price)',
    )
    .eq('slug', slug)
    .maybeSingle<Row>();
  if (!row) notFound();

  const [
    { verification, blockers, documents, events },
    { data: owner },
    { data: email },
  ] = await Promise.all([
    loadVerification(slug),
    supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('provider_slug', slug)
      .maybeSingle(),
    supabase.rpc('admin_owner_email', { p_slug: slug }),
  ]);
  if (!verification) notFound();

  const uploaded = [...new Set([...row.gallery, ...row.work])].filter(
    (u) => !u.startsWith('/images/'),
  );
  const signed = documents.length
    ? await supabase.storage.from('provider-docs').createSignedUrls(
        documents.map((d) => d.path),
        600,
      )
    : { data: [] };
  const urls = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
  const locked = verification.status !== 'pending_review';
  const all = [...blockers.provider, ...blockers.admin];

  const hints: Record<string, string> = {
    intro_video_reviewed: 'Watch the video. Is it the business, clear and appropriate?',
    portfolio_reviewed: 'Look through the photos. Is it real, recent work?',
    contact_verified: 'Phone and email look genuine and match the business.',
    business_verified: 'Name, description, services and prices are credible.',
    category_requirements_met: NEEDS_CERTIFICATE.includes(row.category)
      ? 'A valid trade certificate or registration for this trade.'
      : 'Nothing special is required for this category.',
    documents_checked: 'ID and any certificates open, are readable and match the person.',
  };

  return (
    <div className="max-w-[860px]">
      <Link
        href="/admin/providers"
        className="type-body-s text-muted hover:text-ink inline-flex items-center gap-1.5 py-1 font-semibold"
      >
        <Icon name="skipBack" size={14} />
        All providers
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="type-h1">{row.name}</h1>
          <p className="type-body-s text-muted mt-1">
            {categoryLabel(row.category)} ·{' '}
            {row.area && row.area !== row.city ? `${row.area}, ` : ''}
            {row.city}
          </p>
        </div>
        <StatusBadge status={verification.status} />
      </div>
      {verification.submitted_at ? (
        <p className="type-body-s text-muted mt-2">
          Submitted {date(verification.submitted_at)}
        </p>
      ) : null}
      {verification.status === 'approved' && verification.approved_at ? (
        <p className="type-body-s text-muted mt-1">
          Approved {date(verification.approved_at)}
          {verification.approved_by ? ' by an admin' : ' (existing provider)'}
        </p>
      ) : null}

      <Section title="Business">
        <p className="type-body-s whitespace-pre-wrap">
          {row.about || 'No description yet.'}
        </p>
        {row.provider_services.length > 0 ? (
          <ul className="type-body-s mt-4 flex flex-col gap-1">
            {row.provider_services.map((s) => (
              <li key={s.id}>
                {s.name} · from {formatRand(s.from_price * 100)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-body-s text-muted mt-4">No services added.</p>
        )}
      </Section>

      <Section title="Contact">
        <dl className="type-body-s grid gap-1">
          <div>
            <dt className="text-muted inline">Name: </dt>
            <dd className="inline">{owner?.full_name || 'Not given'}</dd>
          </div>
          <div>
            <dt className="text-muted inline">Phone: </dt>
            <dd className="inline">
              {owner?.phone ? (
                <a className="underline" href={`tel:${owner.phone}`}>
                  {owner.phone}
                </a>
              ) : (
                'Not given'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted inline">Email: </dt>
            <dd className="inline">{(email as string | null) ?? 'Unknown'}</dd>
          </div>
        </dl>
      </Section>

      <Section title="Intro video">
        {verification.intro_video_url ? (
          <a
            href={verification.intro_video_url}
            target="_blank"
            rel="noreferrer noopener"
            className="type-body-s break-all underline"
          >
            {verification.intro_video_url}
          </a>
        ) : (
          <p className="type-body-s text-muted">No video submitted.</p>
        )}
      </Section>

      <Section title={`Portfolio (${uploaded.length} uploaded)`}>
        {uploaded.length === 0 ? (
          <p className="type-body-s text-muted">No uploaded photos.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {uploaded.map((src) => (
              <li
                key={src}
                className="bg-subtle relative aspect-[4/3] overflow-hidden rounded-md"
              >
                <Image src={src} alt="" fill sizes="260px" className="object-cover" />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Documents">
        {documents.length === 0 ? (
          <p className="type-body-s text-muted">No documents uploaded.</p>
        ) : (
          <ul className="type-body-s flex flex-col gap-2">
            {documents.map((d) => (
              <li key={d.id}>
                <span className="text-muted">{DOC_KINDS[d.kind]}: </span>
                {urls.get(d.path) ? (
                  <a
                    href={urls.get(d.path) ?? undefined}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline"
                  >
                    {d.label}
                  </a>
                ) : (
                  d.label
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="type-caption text-muted mt-3">
          Links expire after 10 minutes. Reload to get fresh ones.
        </p>
      </Section>

      <Section title="Vetting checklist">
        <VettingChecklist
          slug={slug}
          locked={locked}
          items={ADMIN_CHECKS.map((c) => ({
            field: c.field,
            label: c.label,
            checked: verification[c.field],
            hint: hints[c.field],
          }))}
        />
        {locked ? (
          <p className="type-caption text-muted mt-3">
            The checklist can only be changed while a listing is under review.
          </p>
        ) : null}
      </Section>

      <Section title="Decision">
        <DecisionPanel slug={slug} status={verification.status} blockers={all} />
      </Section>

      {events.length > 0 ? (
        <Section title="History">
          <ol className="flex flex-col gap-3">
            {events.map((e) => (
              <li key={e.id}>
                <p className="type-body-s font-semibold">
                  {EVENT_LABEL[e.kind] ?? e.kind}
                </p>
                {e.note ? <p className="type-body-s text-muted">{e.note}</p> : null}
                <p className="type-caption text-muted">{date(e.created_at)}</p>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}
    </div>
  );
}
