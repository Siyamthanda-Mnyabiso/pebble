import Link from 'next/link';
import { Icon } from '@/components/icons';

export function SectionHeader({
  title,
  subtitle,
  linkLabel,
  href,
  id,
}: {
  title: string;
  subtitle?: string;
  linkLabel?: string;
  href?: string;
  id?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        <h2 id={id} className="type-h2">
          {title}
        </h2>
        {subtitle ? <p className="type-body text-muted mt-1">{subtitle}</p> : null}
      </div>
      {linkLabel && href ? (
        <Link
          href={href}
          className="type-body-s inline-flex items-center gap-2 font-semibold"
        >
          {linkLabel}
          <Icon name="skip" size={16} />
        </Link>
      ) : null}
    </div>
  );
}
