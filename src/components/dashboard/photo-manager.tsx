'use client';

import Image from 'next/image';
import { useRef, useState, useTransition } from 'react';
import { addPhoto, removePhoto, setMainPhoto } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/button';
import { MAX_PHOTOS, PHOTO_BUCKET, publicPhotoUrl } from '@/lib/photos';
import { createClient } from '@/lib/supabase/client';

const MAX_EDGE = 1600;

/** Shrinks a camera photo to a web-sized JPEG before upload. */
async function resize(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  );
  if (!blob) throw new Error('resize failed');
  return blob;
}

export function PhotoManager({
  slug,
  image,
  work,
}: {
  slug: string;
  image: string;
  work: string[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const photos = [image, ...new Set(work.filter((u) => u !== image))];
  const room = MAX_PHOTOS - photos.length;

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError('');
    const chosen = [...files].slice(0, room);
    if (files.length > room) {
      setError(
        `Only ${room} more ${room === 1 ? 'photo fits' : 'photos fit'}. The rest were skipped.`,
      );
    }
    setUploading(true);
    const supabase = createClient();
    let done = 0;
    for (const file of chosen) {
      setStatus(`Uploading ${done + 1} of ${chosen.length}…`);
      try {
        if (!file.type.startsWith('image/')) throw new Error('not an image');
        const blob = await resize(file);
        const path = `${slug}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, blob, { contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;
        const result = await addPhoto(publicPhotoUrl(path));
        if (!result.ok) {
          await supabase.storage.from(PHOTO_BUCKET).remove([path]);
          setError(result.error);
          break;
        }
        done++;
      } catch {
        setError(`We could not upload ${file.name}. Use a JPEG, PNG or WebP photo.`);
      }
    }
    setStatus(done > 0 ? `${done} ${done === 1 ? 'photo' : 'photos'} added.` : '');
    setUploading(false);
    if (input.current) input.current.value = '';
  }

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError('');
    setStatus('');
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
      setConfirming(null);
    });
  }

  return (
    <div className="mt-8">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {photos.map((url, index) => (
          <li key={url} className="bg-page shadow-card overflow-hidden rounded-lg">
            <div className="relative aspect-[4/3]">
              <Image
                src={url}
                alt={index === 0 ? 'Main photo' : `Photo ${index + 1}`}
                fill
                sizes="(min-width: 1280px) 22vw, (min-width: 640px) 30vw, 45vw"
                className="object-cover"
              />
              {index === 0 ? (
                <span className="bg-dark text-on-dark type-caption absolute top-2 left-2 rounded-full px-3 py-1 font-semibold">
                  Main
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 p-3">
              {index > 0 ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => run(() => setMainPhoto(url))}
                >
                  Make main
                </Button>
              ) : null}
              {index > 0 ? (
                confirming === url ? (
                  <>
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() => run(() => removePhoto(url))}
                    >
                      {pending ? 'Removing…' : 'Yes, remove'}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setConfirming(null)}
                    >
                      Keep
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setConfirming(url)}
                  >
                    Remove
                  </Button>
                )
              ) : (
                <span className="type-caption text-muted py-2">
                  Shown first on your profile
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          id="photo-input"
          disabled={uploading || room <= 0}
          onChange={(event) => upload(event.target.files)}
        />
        <Button disabled={uploading || room <= 0} onClick={() => input.current?.click()}>
          {uploading ? 'Uploading…' : 'Add photos'}
        </Button>
        <p className="type-caption text-muted mt-2">
          {photos.length} of {MAX_PHOTOS} photos. JPEG, PNG or WebP. Big photos are shrunk
          automatically.
        </p>
        <p role="status" className="type-body-s mt-3">
          {status}
        </p>
        {error ? (
          <p role="alert" className="type-body-s text-danger mt-2">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
