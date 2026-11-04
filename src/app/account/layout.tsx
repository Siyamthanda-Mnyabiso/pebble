import { Suspense } from 'react';
import { AccountSidebar, type NavItem } from '@/components/account/sidebar';
import { getProfile, requireUser } from '@/lib/auth';

const accountNav: NavItem[] = [
  { href: '/account/bookings', label: 'Bookings', icon: 'calendar' },
  { href: '/account/saved', label: 'Saved providers', icon: 'heart' },
  { href: '/account/reviews', label: 'Reviews', icon: 'star' },
  { href: '/account/settings', label: 'Profile and settings', icon: 'user' },
];

export default function AccountLayout({ children }: LayoutProps<'/account'>) {
  return (
    <Suspense fallback={<div className="min-h-dvh" aria-hidden="true" />}>
      <Frame>{children}</Frame>
    </Suspense>
  );
}

async function Frame({ children }: { children: React.ReactNode }) {
  const user = await requireUser('/account/bookings');
  const profile = await getProfile(user.id);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <AccountSidebar
        name={profile?.full_name || user.email || ''}
        role={profile?.role ?? 'customer'}
        items={
          profile?.role === 'provider'
            ? [
                { href: '/dashboard', label: 'Provider dashboard', icon: 'home' },
                ...accountNav,
              ]
            : accountNav
        }
      />
      <main className="min-w-0 flex-1 px-4 pt-6 pb-20 md:px-10 md:pt-14 lg:px-16">
        {children}
      </main>
    </div>
  );
}
