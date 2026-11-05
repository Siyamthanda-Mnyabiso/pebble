'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import {
  submitForReview,
  type VerificationState,
} from '@/app/dashboard/verification/actions';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import type { DocumentKind } from '@/lib/verification';

const MAX_DOC = 10 * 1024 * 1024;
const TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const MAX_VIDEO = 50 * 1024 * 1024;
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

/** Uploads the intro video straight to Pebble. Record it on any phone or camera first. */
export function VideoUploader({
  slug,
  currentUrl,
  pendingReplacement,
  locked,
}: {
  slug: string;
  /** A short-lived link to the video on file, if any. */
  currentUrl: string | null;
  /** The video on file is a replacement that has not been approved yet. */
  pendingReplacement: boolean;
  locked: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError('');
    if (!VIDEO_TYPES.includes(file.type))
      return setError('Use an MP4, MOV or WebM video.');
    if (file.size > MAX_VIDEO) {
      return setError(
        'That video is over 50 MB. Record it at 720p or 1080p, or trim it, and try again.',
      );
    }
    setBusy(true);
    const supabase = createClient();
    const ext =
      file.type === 'video/quicktime'
        ? 'mov'
        : file.type === 'video/webm'
          ? 'webm'
          : 'mp4';
    const path = `${slug}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('provider-videos')
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      setBusy(false);
      return setError('The upload failed. Check your connection and try again.');
    }
    const { error: rowError } = await supabase
      .from('provider_verification')
      .update({ video_path: path })
      .eq('provider_slug', slug);
    setBusy(false);
    if (rowError) {
      await supabase.storage.from('provider-videos').remove([path]);
      return setError(
        'The video could not be saved. You cannot change it while we review.',
      );
    }
    if (input.current) input.current.value = '';
    router.refresh();
  }

  return (
    <div className="flex max-w-[560px] flex-col gap-3">
      {currentUrl ? (
        <video
          src={currentUrl}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full rounded-lg bg-black"
        />
      ) : null}
      {pendingReplacement ? (
        <p className="type-body-s bg-subtle rounded-lg px-4 py-3">
          Your new video is waiting for review. Customers still see your previous video
          until it is approved.
        </p>
      ) : null}
      {!locked ? (
        <>
          <input
            ref={input}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            className="sr-only"
            aria-label="Upload intro video"
            onChange={(e) => void upload(e.target.files?.[0])}
          />
          <div>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              {busy
                ? 'Uploading… please wait'
                : currentUrl
                  ? 'Replace video'
                  : 'Upload video'}
            </Button>
          </div>
          <p className="type-caption text-muted">
            A short video (about a minute) introducing yourself and your business. Record
            it on any phone or camera, then upload it here. MP4, MOV or WebM, up to 50 MB.
            Customers will watch it before booking you.
          </p>
        </>
      ) : null}
      {error ? (
        <p role="alert" className="type-body-s text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function DocumentUploader({
  slug,
  kind,
  label,
  locked,
}: {
  slug: string;
  kind: DocumentKind;
  label: string;
  locked: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError('');
    if (!TYPES.includes(file.type)) return setError('Use a PDF, JPEG, PNG or WebP file.');
    if (file.size > MAX_DOC) return setError('That file is over 10 MB.');
    setBusy(true);
    const supabase = createClient();
    const ext =
      file.type === 'application/pdf'
        ? 'pdf'
        : file.type.split('/')[1].replace('jpeg', 'jpg');
    const path = `${slug}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('provider-docs')
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      setBusy(false);
      return setError('The upload failed. Please try again.');
    }
    const { error: rowError } = await supabase
      .from('provider_documents')
      .insert({ provider_slug: slug, kind, label: file.name.slice(0, 120), path });
    setBusy(false);
    if (rowError) {
      await supabase.storage.from('provider-docs').remove([path]);
      return setError('The document could not be saved. Please try again.');
    }
    if (input.current) input.current.value = '';
    router.refresh();
  }

  if (locked) return null;
  return (
    <div>
      <input
        ref={input}
        type="file"
        accept=".pdf,image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label={`Upload: ${label}`}
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? 'Uploading…' : 'Upload file'}
      </Button>
      {error ? (
        <p role="alert" className="type-caption text-danger mt-2">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function RemoveDocument({ id, path }: { id: string; path: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const supabase = createClient();
          await supabase.from('provider_documents').delete().eq('id', id);
          await supabase.storage.from('provider-docs').remove([path]);
          router.refresh();
        })
      }
      className="type-caption text-muted underline disabled:opacity-50"
    >
      {pending ? 'Removing…' : 'Remove'}
    </button>
  );
}

export function SubmitButton({ ready, resubmit }: { ready: boolean; resubmit: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<VerificationState>({});
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-start gap-3">
      <Button
        disabled={!ready || pending}
        onClick={() =>
          start(async () => {
            const result = await submitForReview();
            setState(result);
            if (result.saved) router.refresh();
          })
        }
      >
        {pending ? 'Submitting…' : resubmit ? 'Resubmit for review' : 'Submit for review'}
      </Button>
      {!ready ? (
        <p className="type-body-s text-muted">Finish every item above to submit.</p>
      ) : null}
      {state.error ? (
        <p role="alert" className="type-body-s text-danger">
          {state.error}
        </p>
      ) : null}
      {state.notice ? <p className="type-body-s">{state.notice}</p> : null}
    </div>
  );
}
