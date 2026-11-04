'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  approveReplacementVideo,
  openDocument,
  rejectReplacementVideo,
  type DecisionResult,
} from '@/app/admin/provider-actions';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui/button';

/** Portfolio thumbnails. Any photo opens full size, with next and previous. */
export function PortfolioGallery({ photos, name }: { photos: string[]; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const go = (step: number) =>
    setIndex((i) => (i + step + photos.length) % photos.length);

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((src, i) => (
          <li key={src}>
            <button
              type="button"
              onClick={() => {
                setIndex(i);
                dialog.current?.showModal();
              }}
              aria-label={`Open photo ${i + 1} of ${photos.length}`}
              className="bg-subtle relative block aspect-[4/3] w-full overflow-hidden rounded-md"
            >
              <Image
                src={src}
                alt={`${name}, portfolio photo ${i + 1}`}
                fill
                sizes="240px"
                className="object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        aria-label={`${name} portfolio`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') go(1);
          if (e.key === 'ArrowLeft') go(-1);
        }}
        className="bg-page m-auto h-[min(90dvh,800px)] w-[min(96vw,1100px)] max-w-none rounded-xl p-0 backdrop:bg-black/70"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="type-body-s font-semibold">
              Photo {index + 1} of {photos.length}
            </p>
            <button
              type="button"
              aria-label="Close"
              onClick={() => dialog.current?.close()}
              className="hover:bg-subtle inline-flex size-10 items-center justify-center rounded-full"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className="relative min-h-0 flex-1 bg-black">
            {photos[index] ? (
              <Image
                src={photos[index]}
                alt={`${name}, portfolio photo ${index + 1}`}
                fill
                sizes="1100px"
                className="object-contain"
              />
            ) : null}
            {photos.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="Previous photo"
                  onClick={() => go(-1)}
                  className="bg-page absolute top-1/2 left-3 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full"
                >
                  <Icon name="skipBack" size={18} />
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={() => go(1)}
                  className="bg-page absolute top-1/2 right-3 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full"
                >
                  <Icon name="skip" size={18} />
                </button>
              </>
            ) : null}
          </div>
        </div>
      </dialog>
    </>
  );
}

type Doc = { id: string; kind: string; label: string; path: string };

function isImage(path: string) {
  return /\.(jpe?g|png|webp)$/i.test(path);
}

/**
 * Documents open in an in-app preview. There is no download button and no public
 * address: each preview is a ten minute grant that is logged, and it can be refreshed.
 */
export function DocumentPreview({ docs }: { docs: (Doc & { kindLabel: string })[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [current, setCurrent] = useState<Doc | null>(null);
  const [grant, setGrant] = useState<{ url: string; expiresAt: number } | null>(null);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  function open(doc: Doc) {
    setCurrent(doc);
    setGrant(null);
    setExpired(false);
    setError('');
    dialog.current?.showModal();
    load(doc);
  }

  function load(doc: Doc) {
    start(async () => {
      const result = await openDocument(doc.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError('');
      setExpired(false);
      setGrant({ url: result.url, expiresAt: result.expiresAt });
    });
  }

  useEffect(() => {
    if (!grant) return;
    const wait = Math.max(0, grant.expiresAt - Date.now());
    const timer = setTimeout(() => {
      setExpired(true);
      setGrant(null);
    }, wait);
    return () => clearTimeout(timer);
  }, [grant]);

  function close() {
    dialog.current?.close();
    setGrant(null);
    setCurrent(null);
  }

  return (
    <>
      <ul className="divide-line divide-y">
        {docs.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 py-3">
            <span className="type-body-s min-w-0">
              <span className="text-muted block">{d.kindLabel}</span>
              <span className="block truncate font-semibold">{d.label}</span>
            </span>
            <Button size="sm" variant="secondary" onClick={() => open(d)}>
              Preview
            </Button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        aria-label="Document preview"
        onClose={() => {
          setGrant(null);
          setCurrent(null);
        }}
        onContextMenu={(e) => e.preventDefault()}
        className="bg-page m-auto h-[min(90dvh,860px)] w-[min(96vw,1000px)] max-w-none rounded-xl p-0 backdrop:bg-black/70"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="type-body-s truncate font-semibold">{current?.label}</p>
              <p className="type-caption text-muted">
                Private preview. Access ends after 10 minutes and is logged.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close preview"
              onClick={close}
              className="hover:bg-subtle inline-flex size-10 shrink-0 items-center justify-center rounded-full"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className="bg-subtle relative min-h-0 flex-1">
            {grant && current ? (
              isImage(current.path) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={grant.url}
                  alt={current.label}
                  draggable={false}
                  className="h-full w-full object-contain select-none"
                />
              ) : (
                <iframe
                  title={current.label}
                  src={`${grant.url}#toolbar=0&navpanes=0`}
                  className="h-full w-full"
                />
              )
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                {error ? (
                  <p role="alert" className="type-body-s text-danger">
                    {error}
                  </p>
                ) : expired ? (
                  <p className="type-body-s">This preview expired.</p>
                ) : (
                  <p className="type-body-s text-muted">
                    {pending ? 'Opening securely…' : ''}
                  </p>
                )}
                {(expired || error) && current ? (
                  <Button size="sm" disabled={pending} onClick={() => load(current)}>
                    {pending ? 'Refreshing…' : 'Refresh preview'}
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}

/** Approve or turn down a replacement intro video on an approved provider. */
export function VideoReplacementPanel({ slug }: { slug: string }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [pending, start] = useTransition();

  function run(action: () => Promise<DecisionResult>) {
    start(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.ok) router.refresh();
    });
  }

  return (
    <div className="bg-subtle mt-4 rounded-lg p-4">
      <p className="type-body-s font-semibold">
        A replacement video is waiting for review
      </p>
      <p className="type-caption text-muted mt-1">
        Customers still see the current public video until you approve this one.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Button
          disabled={pending}
          onClick={() => run(() => approveReplacementVideo(slug))}
        >
          Approve new video
        </Button>
      </div>
      <label className="mt-4 block">
        <span className="type-body-s mb-2 block font-semibold">
          Reason, if you turn it down
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={1000}
          className="border-line-strong bg-page type-body-s w-full rounded-md border p-3"
        />
      </label>
      <Button
        className="mt-2"
        variant="secondary"
        disabled={pending || note.trim().length < 5}
        onClick={() => run(() => rejectReplacementVideo(slug, note))}
      >
        Turn down new video
      </Button>
      {result ? (
        <p
          role={result.ok ? 'status' : 'alert'}
          className={`type-body-s mt-3 ${result.ok ? '' : 'text-danger'}`}
        >
          {result.ok ? result.notice : result.error}
        </p>
      ) : null}
    </div>
  );
}
