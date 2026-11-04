'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setSavedProvider } from '@/app/account/actions';
import { Icon } from '@/components/icons';
import { cn } from '@/lib/cn';

/** Heart toggle. Sends signed-out visitors to sign in and brings them back. */
export function SaveButton({
  slug,
  name,
  initialSaved = false,
  className,
  size = 20,
}: {
  slug: string;
  name: string;
  initialSaved?: boolean;
  className?: string;
  size?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [saved, setSaved] = useState(initialSaved);
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from saved` : `Save ${name}`}
      onClick={() => {
        const next = !saved;
        setSaved(next);
        startTransition(async () => {
          const result = await setSavedProvider(slug, next);
          if (!result.ok) {
            setSaved(!next);
            if (result.reason === 'auth') {
              router.push(`/sign-in?next=${encodeURIComponent(pathname)}`);
            }
          } else if (!next) {
            router.refresh();
          }
        });
      }}
      className={cn(
        'bg-page shadow-float inline-flex items-center justify-center rounded-full',
        className,
      )}
    >
      <Icon name={saved ? 'heartFilled' : 'heart'} size={size} />
    </button>
  );
}
