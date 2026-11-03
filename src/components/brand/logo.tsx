import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/cn';

export function Logo({
  tone = 'dark',
  className,
}: {
  /** "dark" is the black wordmark for light backgrounds, "light" is for dark ones. */
  tone?: 'dark' | 'light';
  className?: string;
}) {
  return (
    <Link href="/" aria-label="Pebble home" className={cn('inline-flex', className)}>
      <Image
        src={tone === 'dark' ? '/brand/logo.png' : '/brand/logo-white.png'}
        alt="Pebble"
        width={158}
        height={39}
        priority
        className="h-auto w-[132px] lg:w-[158px]"
      />
    </Link>
  );
}
