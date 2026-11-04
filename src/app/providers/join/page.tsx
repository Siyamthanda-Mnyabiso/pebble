import type { Metadata } from 'next';
import { InfoPage } from '@/components/layout/info-page';

export const metadata: Metadata = { title: 'Become a provider' };

export default function JoinPage() {
  return (
    <InfoPage
      content={{
        title: 'Become a provider',
        description: 'List your services on Pebble.',
        intro: 'List your services, meet new customers and manage bookings in one place.',
        sections: [
          {
            heading: 'How it works',
            items: [
              {
                title: '1. Create your account',
                text: 'Sign up and choose "I offer a service".',
              },
              {
                title: '2. Set up your services',
                text: 'Add your services, prices and the days you work.',
              },
              {
                title: '3. Get booked',
                text: 'Customers book you straight from your profile.',
              },
            ],
          },
          {
            heading: 'Good to know',
            body: [
              'The provider dashboard is still being built. You can create your account now, and we will let you know when you can set up your profile.',
            ],
          },
        ],
        cta: { label: 'Create a provider account', href: '/sign-up?role=provider' },
      }}
    />
  );
}
