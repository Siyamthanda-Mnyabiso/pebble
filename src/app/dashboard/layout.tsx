import { Suspense } from 'react';
import { AccountSidebar, type NavItem } from '@/components/account/sidebar';
import { requireProvider } from '@/lib/dashboard';

const providerNav: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: 'home' },
  { href: '/dashboard/bookings', label: 'Bookings', icon: 'calendar' },
  { href: '/dashboard/messages', label: 'Messages', icon: 'message' },
  { href: '/dashboard/services', label: 'Services', icon: 'box' },
  { href: '/dashboard/availability', label: 'Availability', icon: 'clock' },
  { href: '/dashboard/profile', label: 'Listing', icon: 'sparkles' },
  { href: '/dashboard/photos', label: 'Photos', icon: 'camera' },
  { href: '/dashboard/earnings', label: 'Earnings', icon: 'bolt' },
  { href: '/dashboard/reviews', label: 'Reviews', icon: 'star' },
  { href: '/dashboard/notifications', label: 'Notifications', icon: 'bell' },
  { href: '/dashboard/settings', label: 'Account settings', icon: 'user' },
];

export default function DashboardLayout({ children }: LayoutProps<'/dashboard'>) {
  return (
    <Suspense fallback={<div className="min-h-dvh" aria-hidden="true" />}>
      <Frame>{children}</Frame>
    </Suspense>
  );
}

async function Frame({ children }: { children: React.ReactNode }) {
  const { user, profile, provider } = await requireProvider('/dashboard');
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <AccountSidebar
        name={provider?.name ?? (profile.full_name || user.email || '')}
        role="Provider"
        label="Provider dashboard"
        items={providerNav}
      />
      <main className="min-w-0 flex-1 px-4 pt-6 pb-20 md:px-10 md:pt-14 lg:px-16">
        {children}
      </main>
    </div>
  );
}
