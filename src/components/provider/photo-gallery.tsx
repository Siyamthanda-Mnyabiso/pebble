'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { Icon } from '@/components/icons';

/** Grid spans for the photo mosaic, by how many photos it shows (2 to 5). */
const mosaic: Record<number, string[]> = {
  2: ['col-span-3 row-span-2', 'col-span-1 row-span-2'],
  3: ['col-span-2 row-span-2', 'col-span-2', 'col-span-2'],
  4: ['col-span-2 row-span-2', 'col-span-2', 'col-span-1', 'col-span-1'],
  5: ['col-span-2 row-span-2', 'col-span-1', 'col-span-1', 'col-span-1', 'col-span-1'],
};

/** The photo mosaic. Any photo opens a full-screen viewer with every photo. */
export function PhotoGallery({ photos, name }: { photos: string[]; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [start, setStart] = useState(0);
  const shown = photos.slice(0, 5);

  function open(index: number) {
    setStart(index);
    dialog.current?.showModal();
    // Wait for the dialog to render, then bring the chosen photo into view.
    requestAnimationFrame(() =>
      dialog.current
        ?.querySelector(`[data-photo="${index}"]`)
        ?.scrollIntoView({ block: 'start' }),
    );
  }

  return (
    <>
      <div className="relative">
        {shown.length < 2 ? (
          <button
            type="button"
            onClick={() => open(0)}
            aria-label={`View photos of ${name}`}
            className="bg-subtle relative block aspect-[16/8] w-full overflow-hidden rounded-lg"
          >
            <Image
              src={shown[0]}
              alt={name}
              fill
              priority
              sizes="(min-width: 1280px) 1150px, 100vw"
              className="object-cover"
            />
          </button>
        ) : (
          <div className="grid h-[240px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-lg sm:h-[340px] lg:h-[400px]">
            {shown.map((src, index) => (
              <button
                type="button"
                key={src}
                onClick={() => open(index)}
                aria-label={`View photo ${index + 1} of ${photos.length}`}
                className={`bg-subtle relative block ${mosaic[shown.length][index]}`}
              >
                <Image
                  src={src}
                  alt={index === 0 ? name : ''}
                  fill
                  priority={index === 0}
                  sizes={
                    index === 0
                      ? '(min-width: 1024px) 560px, 60vw'
                      : '(min-width: 1024px) 280px, 30vw'
                  }
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}
        {photos.length > 1 ? (
          <button
            type="button"
            onClick={() => open(0)}
            className="bg-page type-body-s shadow-card absolute right-3 bottom-3 inline-flex h-10 items-center rounded-full px-4 font-semibold"
          >
            Show all {photos.length} photos
          </button>
        ) : null}
      </div>

      <dialog
        ref={dialog}
        aria-label={`Photos of ${name}`}
        className="bg-page m-0 h-dvh max-h-none w-screen max-w-none p-0 backdrop:bg-black/60"
      >
        <div className="bg-page sticky top-0 z-10 flex items-center justify-between px-4 py-3">
          <p className="type-body-s font-semibold">
            {name} · {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
          </p>
          <button
            type="button"
            aria-label="Close photos"
            onClick={() => dialog.current?.close()}
            className="hover:bg-subtle inline-flex size-10 items-center justify-center rounded-full"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <ul
          className="mx-auto flex max-w-[900px] flex-col gap-3 px-4 pb-10"
          data-start={start}
        >
          {photos.map((src, index) => (
            <li
              key={src}
              data-photo={index}
              className="bg-subtle relative aspect-[4/3] scroll-mt-16 overflow-hidden rounded-lg"
            >
              <Image
                src={src}
                alt={`${name}, photo ${index + 1}`}
                fill
                sizes="(min-width: 900px) 900px, 100vw"
                className="object-cover"
              />
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}
