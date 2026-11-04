'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useRef, useState, useTransition } from 'react';
import {
  saveIntroVideo,
  submitForReview,
  type VerificationState,
} from '@/app/dashboard/verification/actions';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

const initial: VerificationState = {};
const MAX_DOC = 10 * 1024 * 1024;
const TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export function VideoForm({ current, locked }: { current: string; locked: boolean }) {
  const [state, action, pending] = useActionState(saveIntroVideo, initial);
  return (
    <form action={action} className="flex max-w-[560px] flex-col gap-3">
      <label className="block">
        <span className="type-body-s mb-2 block font-semibold">Intro video link</span>
        <input
          name="video"
          type="url"
          defaultValue={current}
          disabled={locked}
          placeholder="https://youtu.be/..."
          className="border-line-strong bg-page type-body-s h-12 w-full rounded-md border px-4 disabled:opacity-60"
        />
        <span className="type-caption text-muted mt-1 block">
          A short video (under 2 minutes) of you introducing your business. Upload it to
          YouTube, Vimeo or Google Drive and paste the link. Set it to unlisted, not
          private.
        </span>
      </label>
      {state.error ? (
        <p role="alert" className="type-body-s text-danger">
          {state.error}
        </p>
      ) : null}
      {state.saved ? <p className="type-body-s">Saved.</p> : null}
      {!locked ? (
        <div>
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? 'Saving…' : 'Save link'}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

export function DocumentUploader({
  slug,
  kind,
  label,
  locked,
}: {
  slug: string;
  kind: 'id' | 'business' | 'certification';
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
