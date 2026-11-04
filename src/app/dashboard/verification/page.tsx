import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeading } from '@/components/account/ui';
import { NotLinked } from '@/components/dashboard/booking-row';
import { Icon } from '@/components/icons';
import { ProgressTracker, StatusBadge } from '@/components/verification/status';
import {
  DocumentUploader,
  RemoveDocument,
  SubmitButton,
  VideoUploader,
} from '@/components/verification/provider-forms';
import { requireProvider } from '@/lib/dashboard';
import { createClient } from '@/lib/supabase/server';
import {
  DOC_KINDS,
  EVENT_LABEL,
  loadVerification,
  NEEDS_CERTIFICATE,
  STATUS_META,
} from '@/lib/verification';

export const metadata: Metadata = { title: 'Verification' };

export default function Page() {
  return (
    <>
      <PageHeading
        title="Verification"
        subtitle="Every provider is checked before they appear on Pebble."
      />
      <Suspense fallback={<div className="bg-subtle mt-8 h-96 rounded-lg" aria-hidden />}>
        <Content />
      </Suspense>
    </>
  );
}

const date = (iso: string) =>
  new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));

function Item({
  done,
  title,
  children,
}: {
  done: boolean;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="border-line flex gap-4 border-b py-5 last:border-0">
      <span
        className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${done ? 'bg-dark text-on-dark border-transparent' : 'border-line-strong'}`}
        aria-hidden
      >
        {done ? <Icon name="check" size={12} /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className="type-body-s font-semibold">
          {title}
          <span className="sr-only">{done ? ' (done)' : ' (not done yet)'}</span>
        </p>
        {children ? <div className="mt-3">{children}</div> : null}
      </div>
    </li>
  );
}

async function Content() {
  const { provider } = await requireProvider('/dashboard/verification');
  if (!provider) return <NotLinked />;

  const { verification, blockers, documents, events } = await loadVerification(
    provider.slug,
  );
  if (!verification) return <NotLinked />;
  const supabase = await createClient();
  const videoUrl = verification.video_path
    ? ((
        await supabase.storage
          .from('provider-videos')
          .createSignedUrl(verification.video_path, 3600)
      ).data?.signedUrl ?? null)
    : null;
  const replacementPending =
    verification.video_path !== '' &&
    verification.video_path !== verification.approved_video_path;

  const status = verification.status;
  const meta = STATUS_META[status];
  const editable = status === 'draft' || status === 'changes_requested';
  const missing = new Set(blockers.provider);
  const needsCert = NEEDS_CERTIFICATE.includes(provider.category);
  const docs = (kind: string) => documents.filter((d) => d.kind === kind);

  const checklist = [
    {
      title: 'Business description (40+ characters)',
      done: !missing.has('Write a business description of at least 40 characters'),
      link: '/dashboard/profile',
      cta: 'Edit listing',
    },
    {
      title: 'At least one service with a price',
      done: !missing.has('Add at least one service with a price'),
      link: '/dashboard/services',
      cta: 'Add services',
    },
    {
      title: 'At least 3 portfolio photos',
      done: !missing.has('Upload at least 3 portfolio photos'),
      link: '/dashboard/photos',
      cta: 'Add photos',
    },
    {
      title: 'Phone number on your account',
      done: !missing.has('Add a phone number in your account settings'),
      link: '/dashboard/settings',
      cta: 'Add phone',
    },
  ];

  return (
    <div className="max-w-[760px]">
      <section className="bg-page shadow-card mt-8 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="type-h2">{meta.headline}</h2>
          <StatusBadge status={status} />
        </div>
        <p className="type-body-s text-muted mt-2">{meta.message}</p>
        {verification.note && status !== 'approved' ? (
          <div role="note" className="bg-subtle type-body-s mt-4 rounded-lg px-4 py-3">
            <p className="font-semibold">
              {status === 'changes_requested'
                ? 'What we need from you'
                : 'Message from Pebble'}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{verification.note}</p>
          </div>
        ) : null}
        {status === 'approved' && verification.approved_at ? (
          <p className="type-body-s text-muted mt-2">
            Approved on {date(verification.approved_at)}.{' '}
            <Link href={`/providers/${provider.slug}`} className="underline">
              View your public listing
            </Link>
          </p>
        ) : null}
        <div className="mt-6">
          <ProgressTracker status={status} />
        </div>
      </section>

      {status === 'pending_review' ? (
        <p className="type-body-s text-muted mt-6">
          Your details are locked while we review them. Nothing else for you to do right
          now.
        </p>
      ) : null}

      {status === 'draft' ||
      status === 'changes_requested' ||
      status === 'pending_review' ? (
        <section className="mt-10">
          <h2 className="type-h2">What we need</h2>
          <ul className="mt-2">
            {checklist.map((item) => (
              <Item key={item.title} done={item.done} title={item.title}>
                {!item.done && editable ? (
                  <Link href={item.link} className="type-body-s font-semibold underline">
                    {item.cta}
                  </Link>
                ) : null}
              </Item>
            ))}
            <Item done={!missing.has('Upload your intro video')} title="Intro video">
              <VideoUploader
                slug={provider.slug}
                currentUrl={videoUrl}
                pendingReplacement={false}
                locked={!editable}
              />
            </Item>
            <Item done={!missing.has('Upload a copy of your ID')} title={DOC_KINDS.id}>
              <DocList items={docs('id')} locked={!editable} />
              <DocumentUploader
                slug={provider.slug}
                kind="id"
                label={DOC_KINDS.id}
                locked={!editable}
              />
            </Item>
            {needsCert ? (
              <Item
                done={!missing.has('Upload your trade certificate or registration')}
                title={DOC_KINDS.certification}
              >
                <DocList items={docs('certification')} locked={!editable} />
                <DocumentUploader
                  slug={provider.slug}
                  kind="certification"
                  label={DOC_KINDS.certification}
                  locked={!editable}
                />
              </Item>
            ) : null}
            <Item done={docs('business').length > 0} title={DOC_KINDS.business}>
              <DocList items={docs('business')} locked={!editable} />
              <DocumentUploader
                slug={provider.slug}
                kind="business"
                label={DOC_KINDS.business}
                locked={!editable}
              />
            </Item>
          </ul>

          {editable ? (
            <div className="mt-6">
              <SubmitButton
                ready={blockers.provider.length === 0}
                resubmit={status === 'changes_requested'}
              />
            </div>
          ) : null}
          <p className="type-caption text-muted mt-4">
            Documents are private. Only the Pebble team can see them.
          </p>
        </section>
      ) : null}

      {status === 'approved' ? (
        <section className="mt-10">
          <h2 className="type-h2">Intro video</h2>
          <p className="type-body-s text-muted mt-1 mb-4">
            Customers see this on your profile. A replacement is checked by the Pebble
            team before it goes live.
          </p>
          <VideoUploader
            slug={provider.slug}
            currentUrl={videoUrl}
            pendingReplacement={replacementPending}
            locked={false}
          />
        </section>
      ) : null}

      {events.length > 0 ? (
        <section className="mt-10">
          <h2 className="type-h2">History</h2>
          <ol className="mt-4 flex flex-col gap-4">
            {events.map((event) => (
              <li key={event.id}>
                <p className="type-body-s font-semibold">
                  {EVENT_LABEL[event.kind] ?? event.kind}
                </p>
                {event.note ? (
                  <p className="type-body-s text-muted">{event.note}</p>
                ) : null}
                <p className="type-caption text-muted">{date(event.created_at)}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function DocList({
  items,
  locked,
}: {
  items: { id: string; label: string; path: string }[];
  locked: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="mb-3 flex flex-col gap-1">
      {items.map((d) => (
        <li key={d.id} className="type-body-s flex items-center gap-3">
          <span className="min-w-0 truncate">{d.label}</span>
          {!locked ? <RemoveDocument id={d.id} path={d.path} /> : null}
        </li>
      ))}
    </ul>
  );
}
