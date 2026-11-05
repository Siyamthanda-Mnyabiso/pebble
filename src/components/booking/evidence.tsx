'use client';

import { useRef, useState } from 'react';
import { addEvidence } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
export const MAX_EVIDENCE_PHOTOS = 6;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Check the chosen photos before anything is uploaded. Returns an error, or nothing when fine. */
export function checkEvidenceFiles(files: File[], alreadyAdded = 0): string {
  if (files.length + alreadyAdded > MAX_EVIDENCE_PHOTOS) {
    return `You can add up to ${MAX_EVIDENCE_PHOTOS} photos.`;
  }
  for (const f of files) {
    if (!TYPES.includes(f.type)) return 'Choose JPEG, PNG or WebP photos.';
    if (f.size > MAX_EVIDENCE_BYTES)
      return `${f.name} is over 5 MB. Choose a smaller photo.`;
  }
  return '';
}

/** Upload photos into the private bucket and record each one against the dispute. */
export async function uploadEvidence(disputeId: string, files: File[]): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return 'Please sign in again.';
  for (const file of files) {
    const ext =
      file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${disputeId}/${data.user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from('dispute-evidence')
      .upload(path, file, { contentType: file.type });
    if (error) return 'A photo could not be uploaded. Please try again.';
    const saved = await addEvidence(disputeId, path, file.type, file.size);
    if (!saved.ok) return saved.error;
  }
  return '';
}

/** Add more photos to an open dispute. */
export function EvidenceUploader({
  disputeId,
  added,
}: {
  disputeId: string;
  added: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function send(files: File[]) {
    setDone(false);
    const problem = checkEvidenceFiles(files, added);
    if (problem) return setError(problem);
    setBusy(true);
    setError('');
    const failed = await uploadEvidence(disputeId, files);
    setBusy(false);
    if (input.current) input.current.value = '';
    if (failed) setError(failed);
    else {
      setDone(true);
      window.location.reload();
    }
  }

  return (
    <div className="mt-4">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        id={`evidence-${disputeId}`}
        onChange={(e) => void send(Array.from(e.target.files ?? []))}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={busy || added >= MAX_EVIDENCE_PHOTOS}
        onClick={() => input.current?.click()}
      >
        {busy ? 'Uploading…' : 'Add photos'}
      </Button>
      <p className="type-caption text-muted mt-1">
        Up to {MAX_EVIDENCE_PHOTOS} photos, 5 MB each. Only you, the other person and
        Pebble can see them.
      </p>
      {error ? (
        <p role="alert" className="type-caption text-danger mt-1">
          {error}
        </p>
      ) : null}
      {done ? <p className="type-caption mt-1">Photos added.</p> : null}
    </div>
  );
}

/** Thumbnails of the evidence, labelled with who added each one. */
export function EvidenceGallery({
  items,
}: {
  items: { id: string; url: string; by: 'customer' | 'provider'; created_at: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <li key={item.id}>
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt={`Photo added by the ${item.by}`}
              className="bg-subtle aspect-square w-full rounded-lg object-cover"
            />
            <span className="type-caption text-muted mt-1 block capitalize">
              {item.by}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
