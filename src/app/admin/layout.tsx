import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AccountSidebar, type NavItem } from '@/components/account/sidebar';
import { requireAdmin } from '@/lib/admin';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Admin' } };

const nav: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: 'home' },
  { href: '/admin/bookings', label: 'Bookings', icon: 'calendar' },
  { href: '/admin/providers', label: 'Providers', icon: 'box' },
  { href: '/admin/customers', label: 'Customers', icon: 'user' },
  { href: '/admin/categories', label: 'Categories', icon: 'sparkles' },
  { href: '/admin/disputes', label: 'Disputes', icon: 'message' },
  { href: '/admin/payments', label: 'Payments', icon: 'bolt' },
  { href: '/admin/reviews', label: 'Reviews', icon: 'star' },
  { href: '/admin/reports', label: 'Reports', icon: 'info' },
  { href: '/admin/settings', label: 'Settings', icon: 'sparkles' },
];

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <Suspense fallback={<div className="min-h-dvh" aria-hidden="true" />}>
      <Frame>{children}</Frame>
    </Suspense>
  );
}

async function Frame({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireAdmin('/admin');
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <AccountSidebar
        name={profile.full_name || user.email || ''}
        role="Platform admin"
        label="Admin"
        items={nav}
      />
      <main className="min-w-0 flex-1 px-4 pt-6 pb-20 md:px-10 md:pt-14 lg:px-12">
        {children}
      </main>
    </div>
  );
}
