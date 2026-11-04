import Image from 'next/image';
import Link from 'next/link';
import { EmptyState } from '@/components/account/ui';
import type { Thread } from '@/lib/messages';

/** The list of conversations. `base` is /account/messages or /dashboard/messages. */
export function Inbox({
  threads,
  base,
  empty,
}: {
  threads: Thread[];
  base: string;
  empty: string;
}) {
  if (threads.length === 0) {
    return <EmptyState title="No messages yet" body={empty} />;
  }
  return (
    <ul className="bg-page shadow-card divide-line mt-8 divide-y rounded-xl px-4 sm:px-6">
      {threads.map((t) => (
        <li key={t.bookingId}>
          <Link href={`${base}/${t.bookingId}`} className="flex items-center gap-4 py-4">
            {t.image ? (
              <span className="relative size-12 shrink-0 overflow-hidden rounded-full">
                <Image src={t.image} alt="" fill sizes="48px" className="object-cover" />
              </span>
            ) : (
              <span className="bg-subtle type-label inline-flex size-12 shrink-0 items-center justify-center rounded-full">
                {t.name[0]}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="type-h4 block truncate">{t.name}</span>
              <span className="type-caption text-muted block truncate">{t.service}</span>
              <span
                className={`type-body-s mt-0.5 block truncate ${t.unread ? 'font-semibold' : 'text-muted'}`}
              >
                {t.last}
              </span>
            </span>
            {t.unread > 0 ? (
              <span className="bg-dark text-on-dark type-caption inline-flex size-6 shrink-0 items-center justify-center rounded-full font-semibold">
                {t.unread}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
