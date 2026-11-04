import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/icons';

export const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2.5 rounded-full font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:bg-subtle disabled:text-disabled',
  {
    variants: {
      variant: {
        primary: 'bg-dark text-on-dark hover:bg-hover active:bg-pressed',
        secondary:
          'border-[1.5px] border-line-strong bg-page text-ink hover:bg-subtle active:bg-subtle',
        light: 'bg-page text-ink hover:bg-subtle',
        ghost: 'text-ink hover:bg-subtle',
      },
      size: {
        sm: 'h-9 px-4 type-body-s',
        md: 'h-11 px-5 type-label',
        lg: 'h-12 px-6 type-label',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type ButtonStyleProps = VariantProps<typeof buttonStyles>;

type ButtonProps = ComponentProps<'button'> & ButtonStyleProps;

export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonStyles({ variant, size }), className)}
      {...props}
    />
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> &
  ButtonStyleProps & {
    /** Show the Pebble forward arrow after the label. */
    arrow?: boolean;
  };

export function ButtonLink({
  variant,
  size,
  arrow,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={cn(buttonStyles({ variant, size }), className)} {...props}>
      {children}
      {arrow ? <Icon name="skip" size={18} /> : null}
    </Link>
  );
}

/** The round dark button with the Pebble arrow. Use inside cards and search bars. */
export function ArrowButton({
  size = 40,
  label,
  className,
  ...props
}: Omit<ComponentProps<'button'>, 'children'> & { size?: number; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'bg-dark text-on-dark hover:bg-hover inline-flex shrink-0 items-center justify-center rounded-full transition-colors',
        className,
      )}
      style={{ width: size, height: size }}
      {...props}
    >
      <Icon name="skip" size={Math.round(size * 0.5)} />
    </button>
  );
}

/** The same arrow as a decorative element (when the whole card is the link). */
export function ArrowBadge({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'bg-dark text-on-dark inline-flex shrink-0 items-center justify-center rounded-full',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Icon name="skip" size={Math.round(size * 0.5)} />
    </span>
  );
}
