import type { IconName } from '@/components/icons';

/**
 * Static content for the landing page. This will be replaced by Supabase
 * queries once the database exists; the shapes here are what the UI expects.
 */

export type ServiceCategory = { slug: string; label: string; icon: IconName };

export const serviceCategories: ServiceCategory[] = [
  { slug: 'cleaning', label: 'Cleaning', icon: 'spray' },
  { slug: 'plumbing', label: 'Plumbing', icon: 'tap' },
  { slug: 'electrical', label: 'Electrical', icon: 'bolt' },
  { slug: 'gardening', label: 'Gardening', icon: 'leaf' },
  { slug: 'painting', label: 'Painting', icon: 'roller' },
  { slug: 'moving', label: 'Moving', icon: 'box' },
  { slug: 'beauty', label: 'Beauty', icon: 'scissors' },
  { slug: 'photography', label: 'Photography', icon: 'camera' },
];

export type ProviderSummary = {
  slug: string;
  name: string;
  rating: number;
  reviewCount: number;
  /** Starting price in rand. */
  fromPrice: number;
  image: string;
};

export const trustStats = [
  { value: '4.8', label: 'Average rating from 60,000 jobs' },
  { value: '12,000+', label: 'Background-checked providers' },
  { value: 'Under 2 hrs', label: 'Typical time to first reply' },
];

export type Review = {
  quote: string;
  name: string;
  service: string;
  date: string;
  avatar: string;
};

export const reviews: Review[] = [
  {
    quote:
      'Booked a deep clean for Saturday morning and the house has never looked better. Already rebooked for next month.',
    name: 'Johan V.',
    service: 'Cleaning',
    date: 'October 2026',
    avatar: '/images/portrait-m.jpg',
  },
  {
    quote:
      'Arrived within the hour, fixed our leaking tap and cleaned up after himself. Honest pricing too.',
    name: 'Lerato M.',
    service: 'Plumbing',
    date: 'October 2026',
    avatar: '/images/portrait-f.jpg',
  },
  {
    quote:
      'Our garden was a jungle. Two hours later it looked like a magazine. Friendly, on time, fair price.',
    name: 'Nomsa K.',
    service: 'Gardening',
    date: 'September 2026',
    avatar: '/images/pro-puff.jpg',
  },
];

export const steps: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'search',
    title: 'Tell us what you need',
    body: 'Search by service and suburb. Add a date and we show who is free.',
  },
  {
    icon: 'starFilled',
    title: 'Compare and choose',
    body: 'See real reviews, clear prices and recent work before you decide.',
  },
  {
    icon: 'check',
    title: 'Book and relax',
    body: 'Confirm in a few taps, confirm the job when it is done, rate when you are happy.',
  },
];

export const footerColumns: {
  heading: string;
  links: { label: string; href: string }[];
}[] = [
  {
    heading: 'Explore',
    links: [
      { label: 'All services', href: '/explore' },
      { label: 'Popular providers', href: '/explore?sort=popular' },
      { label: 'Gift cards', href: '/gift-cards' },
      { label: 'How it works', href: '/#how-it-works' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About Pebble', href: '/about' },
      { label: 'Careers', href: '/careers' },
      { label: 'Press', href: '/press' },
      { label: 'Blog', href: '/blog' },
    ],
  },
  {
    heading: 'Providers',
    links: [
      { label: 'Become a provider', href: '/providers/join' },
      { label: 'Provider log in', href: '/providers/sign-in' },
      { label: 'Resources', href: '/providers/resources' },
      { label: 'Safety', href: '/safety' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Help centre', href: '/help' },
      { label: 'Contact us', href: '/contact' },
      { label: 'Cancellation policy', href: '/cancellation-policy' },
      { label: 'Trust and safety', href: '/safety' },
    ],
  },
];
