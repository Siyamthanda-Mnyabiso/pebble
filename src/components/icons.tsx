import type { ReactNode, SVGProps } from 'react';

/**
 * The Pebble icon set. Every icon follows one rule: thick rounded strokes plus
 * a small "pebble" dot as the signature. They draw in `currentColor`, so colour
 * them with a text colour class.
 */

const stroke = (width = 2.6) =>
  ({
    stroke: 'currentColor',
    strokeWidth: width,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
  }) as const;

function Pebble({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return <ellipse cx={cx} cy={cy} rx={r * 1.1} ry={r} fill="currentColor" />;
}

const star =
  'M12 3.5L14.6 9L20.5 9.7L16.1 13.7L17.3 19.6L12 16.7L6.7 19.6L7.9 13.7L3.5 9.7L9.4 9Z';
const heart =
  'M12 20C12 20 3.5 14.8 3.5 9.2A4.4 4.4 0 0 1 12 7.4A4.4 4.4 0 0 1 20.5 9.2C20.5 14.8 12 20 12 20Z';

const glyphs = {
  /* Navigation arrows: a chevron with a pebble trailing behind. */
  skip: (
    <>
      <path d="M10.5 5.5L17 12L10.5 18.5" {...stroke(3.2)} />
      <Pebble cx={4.2} cy={12} r={1.9} />
    </>
  ),
  skipBack: (
    <>
      <path d="M13.5 5.5L7 12L13.5 18.5" {...stroke(3.2)} />
      <Pebble cx={19.8} cy={12} r={1.9} />
    </>
  ),
  chevronDown: (
    <>
      <path d="M5.5 10L12 16.5L18.5 10" {...stroke(3.2)} />
      <Pebble cx={12} cy={4.6} r={2} />
    </>
  ),
  check: <path d="M4.5 12.5L10 18L19.5 6.5" {...stroke(3.2)} />,
  close: <path d="M6 6L18 18M18 6L6 18" {...stroke(3.2)} />,
  plus: <path d="M12 5V19M5 12H19" {...stroke(3.2)} />,
  menu: (
    <>
      <path d="M4.5 6.5H19.5M4.5 12H19.5M4.5 17.5H13.5" {...stroke(3)} />
      <Pebble cx={18.8} cy={17.5} r={1.7} />
    </>
  ),

  /* Everyday UI */
  search: (
    <>
      <circle cx={10.5} cy={10.5} r={6.2} {...stroke()} />
      <path d="M15.3 15.3L17.4 17.4" {...stroke()} />
      <Pebble cx={20.2} cy={20.2} r={1.6} />
    </>
  ),
  pin: (
    <>
      <path
        d="M12 21C12 21 5 14.8 5 9.6A7 7 0 0 1 19 9.6C19 14.8 12 21 12 21Z"
        {...stroke()}
      />
      <Pebble cx={12} cy={9.6} r={2.2} />
    </>
  ),
  heart: (
    <>
      <path d={heart} {...stroke()} />
      <Pebble cx={7.4} cy={10.4} r={1.3} />
    </>
  ),
  heartFilled: (
    <path
      d={heart}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinejoin="round"
    />
  ),
  star: <path d={star} {...stroke(2.4)} />,
  starFilled: (
    <path
      d={star}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinejoin="round"
    />
  ),
  verified: (
    <>
      <path
        d="M12 3C17.2 2.6 21.2 6.6 20.9 12C20.6 17.5 16.6 21.2 11.6 20.9C6.4 20.6 2.8 16.8 3.1 11.6C3.4 6.6 7.2 3.3 12 3Z"
        {...stroke(2.4)}
      />
      <path d="M8.4 12.3L11 14.9L15.8 9.4" {...stroke(2.8)} />
    </>
  ),
  calendar: (
    <>
      <rect x={3.5} y={5} width={17} height={15.5} rx={4.5} {...stroke()} />
      <path d="M3.5 10.5H20.5" {...stroke()} />
      <Pebble cx={8.6} cy={15.2} r={1.5} />
      <Pebble cx={15.4} cy={15.2} r={1.5} />
    </>
  ),
  clock: (
    <>
      <circle cx={12} cy={12} r={8.6} {...stroke()} />
      <path d="M12 7.6V12L15.4 14" {...stroke()} />
    </>
  ),
  info: (
    <>
      <circle cx={12} cy={12} r={8.6} {...stroke()} />
      <Pebble cx={12} cy={7.9} r={1.5} />
      <path d="M12 11.5V16.5" {...stroke(3)} />
    </>
  ),
  home: (
    <>
      <path
        d="M4 11L12 4L20 11V18.5A2 2 0 0 1 18 20.5H6A2 2 0 0 1 4 18.5Z"
        {...stroke()}
      />
      <Pebble cx={12} cy={15} r={2} />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11A6 6 0 0 1 18 11V16.5L19.5 18H4.5Z" {...stroke()} />
      <Pebble cx={12} cy={21} r={1.7} />
    </>
  ),
  message: (
    <>
      <path
        d="M5.5 4.5H18.5A3 3 0 0 1 21.5 7.5V13.5A3 3 0 0 1 18.5 16.5H11L6.5 20.2V16.5H5.5A3 3 0 0 1 2.5 13.5V7.5A3 3 0 0 1 5.5 4.5Z"
        {...stroke()}
      />
      <Pebble cx={8} cy={10.5} r={1.3} />
      <Pebble cx={12} cy={10.5} r={1.3} />
      <Pebble cx={16} cy={10.5} r={1.3} />
    </>
  ),
  share: (
    <>
      <path d="M7.8 11L15.6 7M7.8 13L15.6 17" {...stroke(2.4)} />
      <circle cx={6} cy={12} r={2.8} fill="currentColor" />
      <circle cx={17.6} cy={6} r={2.8} fill="currentColor" />
      <circle cx={17.6} cy={18} r={2.8} fill="currentColor" />
    </>
  ),
  user: (
    <>
      <circle cx={12} cy={8} r={4} {...stroke()} />
      <path d="M4.5 20.5C4.5 16.5 8 14.5 12 14.5S19.5 16.5 19.5 20.5" {...stroke()} />
    </>
  ),
  sparkles: (
    <>
      <path
        d="M10 4.5L11.8 9.2L16.5 11L11.8 12.8L10 17.5L8.2 12.8L3.5 11L8.2 9.2Z"
        {...stroke(2.4)}
      />
      <Pebble cx={18.5} cy={5.8} r={1.7} />
      <Pebble cx={18.2} cy={17.5} r={1.4} />
    </>
  ),

  /* Service categories */
  spray: (
    <>
      <rect x={3.8} y={10.5} width={10.4} height={10.7} rx={3.6} {...stroke()} />
      <path d="M7 10.5V5.6H13.2" {...stroke()} />
      <path d="M7.8 15.8H10.4" {...stroke(2.4)} />
      <Pebble cx={17.2} cy={5.4} r={1.5} />
      <Pebble cx={20.6} cy={7.6} r={1.4} />
      <Pebble cx={17.8} cy={9.6} r={1.3} />
      <Pebble cx={20.8} cy={11.8} r={1.1} />
    </>
  ),
  tap: (
    <>
      <path d="M4 8.5H13.5A3.5 3.5 0 0 1 17 12V14" {...stroke()} />
      <path d="M8.5 8.5V5H13" {...stroke()} />
      <Pebble cx={17} cy={19} r={1.7} />
    </>
  ),
  bolt: (
    <>
      <path d="M13 3L5.5 13.5H11.5L10.5 21L18.5 10H12.5L13 3Z" {...stroke()} />
      <Pebble cx={19.5} cy={4.8} r={1.5} />
    </>
  ),
  leaf: (
    <>
      <path d="M6 20C14 20 20 15 20 5C10 5 5 10 5 19L12 12" {...stroke()} />
      <Pebble cx={19.5} cy={19.5} r={1.5} />
    </>
  ),
  roller: (
    <>
      <rect x={3.5} y={3.5} width={13} height={5} rx={2.5} {...stroke()} />
      <path d="M16.5 6H19.5V11H11.5V14" {...stroke()} />
      <rect x={9.5} y={14} width={4} height={6.5} rx={1.5} {...stroke(2.4)} />
    </>
  ),
  box: (
    <>
      <path d="M12 3L4 7V17L12 21L20 17V7Z" {...stroke(2.4)} />
      <path d="M4 7L12 11L20 7M12 11V21" {...stroke(2.4)} />
    </>
  ),
  scissors: (
    <>
      <circle cx={6} cy={6} r={2.6} {...stroke()} />
      <circle cx={6} cy={18} r={2.6} {...stroke()} />
      <path d="M8 7.5L20 18M8 16.5L20 6" {...stroke()} />
    </>
  ),
  camera: (
    <>
      <rect x={3} y={7} width={18} height={13} rx={4} {...stroke()} />
      <path d="M8.5 7L9.7 4.8H14.3L15.5 7" {...stroke()} />
      <circle cx={12} cy={13.5} r={3.2} {...stroke()} />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof glyphs;

/** Categories store an icon name as text; unknown names fall back to a neutral icon. */
export function asIconName(value: string): IconName {
  return Object.hasOwn(glyphs, value) ? (value as IconName) : 'sparkles';
}

type IconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: IconName;
  size?: number;
  /** Label for screen readers. Icons are decorative (hidden) without one. */
  label?: string;
};

export function Icon({ name, size = 24, label, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...props}
    >
      {glyphs[name]}
    </svg>
  );
}
