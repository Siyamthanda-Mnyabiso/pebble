export type PageSection = {
  heading: string;
  body?: string[];
  items?: { title: string; text: string }[];
};

export type InfoContent = {
  title: string;
  description: string;
  intro: string;
  sections: PageSection[];
  cta?: { label: string; href: string };
  draft?: boolean;
};

const legalNote =
  'This is a draft written for the Pebble preview. It will be reviewed by a lawyer before launch.';

export const infoPages: Record<string, InfoContent> = {
  about: {
    title: 'About Pebble',
    description: 'Why we are building Pebble.',
    intro:
      'Pebble helps people in South Africa find trusted providers for home, lifestyle and everyday services, and book them in minutes.',
    sections: [
      {
        heading: 'What we are doing',
        body: [
          'Finding a good cleaner, plumber or hairdresser usually means asking around and hoping. Pebble puts verified providers, honest prices and real reviews in one place.',
          'We are starting in Cape Town and will grow city by city. Prices are in Rand and every provider lists what they charge up front.',
        ],
      },
      {
        heading: 'What we care about',
        items: [
          {
            title: 'Clear prices',
            text: 'Starting prices on every service, no surprises.',
          },
          { title: 'Real reviews', text: 'Only customers who booked can review.' },
          {
            title: 'Fair to providers',
            text: 'Small businesses keep control of their services and availability.',
          },
        ],
      },
    ],
    cta: { label: 'Browse providers', href: '/explore' },
  },
  careers: {
    title: 'Careers',
    description: 'Work at Pebble.',
    intro: 'We are a small team and not hiring for any role right now.',
    sections: [
      {
        heading: 'Open roles',
        body: [
          'There are no open roles at the moment. When that changes, they will be listed here first.',
        ],
      },
    ],
    cta: { label: 'Get in touch', href: '/contact' },
  },
  press: {
    title: 'Press',
    description: 'Press enquiries.',
    intro: 'Writing about Pebble? We are happy to help.',
    sections: [
      {
        heading: 'Press enquiries',
        body: [
          'Send us a message with your deadline and what you need, and we will reply as soon as we can.',
        ],
      },
    ],
    cta: { label: 'Contact us', href: '/contact' },
  },
  blog: {
    title: 'Blog',
    description: 'News and tips from Pebble.',
    intro: 'Tips for hiring well, and news from the team.',
    sections: [
      {
        heading: 'Nothing here yet',
        body: ['Our first posts are on the way. Check back soon.'],
      },
    ],
    cta: { label: 'Browse providers', href: '/explore' },
  },
  help: {
    title: 'Help centre',
    description: 'Answers to common questions.',
    intro: 'Quick answers about booking, paying and your account.',
    sections: [
      {
        heading: 'Booking',
        items: [
          {
            title: 'How do I book?',
            text: 'Pick a provider, choose a service, date and time, then confirm. You need an account to confirm.',
          },
          {
            title: 'When do I pay?',
            text: "You pay the provider's listed price and nothing on top. Payments are not switched on in this preview, so you are not charged yet.",
          },
          {
            title: 'Can I change or cancel a booking?',
            text: 'See the cancellation policy. Cancelling from your account is coming soon, so contact us for now.',
          },
        ],
      },
      {
        heading: 'Your account',
        items: [
          {
            title: 'I forgot my password',
            text: 'Use "Forgot password" on the sign in page and we will email you a reset link.',
          },
          {
            title: 'Where are my bookings?',
            text: 'Under Bookings in your account, split into upcoming and previous.',
          },
          {
            title: 'How do I leave a review?',
            text: 'Once a booking is completed, it appears under Reviews in your account.',
          },
        ],
      },
    ],
    cta: { label: 'Still stuck? Contact us', href: '/contact' },
  },
  safety: {
    title: 'Trust and safety',
    description: 'How Pebble keeps bookings safe.',
    intro: 'Letting someone into your home takes trust. Here is how we help.',
    sections: [
      {
        heading: 'On Pebble',
        items: [
          {
            title: 'Verified badge',
            text: 'Providers with the badge have had their details checked by us.',
          },
          {
            title: 'Reviews from real bookings',
            text: 'Only customers with a completed booking can leave a review.',
          },
          {
            title: 'Stay on Pebble',
            text: 'Keep bookings and messages on the platform so we can help if something goes wrong.',
          },
        ],
      },
      {
        heading: 'Tips',
        body: [
          'Check the reviews and the work photos before you book. Share the address only in the booking. If something feels wrong, end the job and tell us.',
        ],
      },
    ],
    cta: { label: 'Report a concern', href: '/contact' },
  },
  'cancellation-policy': {
    title: 'Cancellation policy',
    description: 'What happens when plans change.',
    intro: 'Plans change. This is how cancelling and rescheduling works.',
    draft: true,
    sections: [
      {
        heading: 'Customers',
        body: [
          'Cancel or reschedule more than 24 hours before the start time at no cost.',
          'Within 24 hours, the provider may charge a call-out fee. You pay nothing at booking, so nothing is refunded or held.',
        ],
      },
      {
        heading: 'Providers',
        body: [
          'If a provider cancels, the booking is cancelled at no cost to you and you can book someone else.',
        ],
      },
      { heading: 'Note', body: [legalNote] },
    ],
  },
  terms: {
    title: 'Terms of use',
    description: 'The terms for using Pebble.',
    intro: 'By using Pebble you agree to these terms.',
    draft: true,
    sections: [
      {
        heading: 'What Pebble is',
        body: [
          'Pebble is a marketplace that connects customers with independent service providers. Providers are not employees of Pebble and set their own prices.',
        ],
      },
      {
        heading: 'Your account',
        body: [
          'Keep your sign in details safe and give accurate information. You are responsible for activity on your account.',
        ],
      },
      {
        heading: 'Bookings',
        body: [
          'A booking is an agreement between you and the provider. Pebble helps arrange it but does not perform the service.',
        ],
      },
      {
        heading: 'Reviews',
        body: [
          'Reviews must be honest and about a booking you made. We may remove others.',
        ],
      },
      { heading: 'Note', body: [legalNote] },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    description: 'How Pebble handles your information.',
    intro:
      'What we collect, why, and the choices you have, in line with the Protection of Personal Information Act (POPIA).',
    draft: true,
    sections: [
      {
        heading: 'What we collect',
        body: [
          'Your name, email, phone number and address, your bookings, saved providers and reviews.',
        ],
      },
      {
        heading: 'How we use it',
        body: [
          'To run your account, arrange bookings with providers and keep the service safe. We do not sell your information.',
        ],
      },
      {
        heading: 'Sharing',
        body: [
          'A provider sees the details needed to do your booking, such as your name, address and notes.',
        ],
      },
      {
        heading: 'Your choices',
        body: [
          'You can update your details and notification settings in your account. To ask for your data to be deleted, contact us.',
        ],
      },
      { heading: 'Note', body: [legalNote] },
    ],
  },
  'gift-cards': {
    title: 'Gift cards',
    description: 'Give someone a service.',
    intro: 'Gift cards are coming soon.',
    sections: [
      {
        heading: 'Not available yet',
        body: [
          'We are working on gift cards that can be used with any provider. Tell us you are interested and we will let you know.',
        ],
      },
    ],
    cta: { label: 'Contact us', href: '/contact' },
  },
};

export const providerResources: InfoContent = {
  title: 'Provider resources',
  description: 'Tips for running your business on Pebble.',
  intro: 'A few things that help providers get booked and get good reviews.',
  sections: [
    {
      heading: 'Getting started',
      items: [
        {
          title: 'Complete your profile',
          text: 'A clear photo, a short description and your area help customers choose you.',
        },
        {
          title: 'List clear prices',
          text: 'Give each service a starting price and what it includes.',
        },
        {
          title: 'Keep availability current',
          text: 'Customers can only book the days and times you open up.',
        },
      ],
    },
    {
      heading: 'Getting reviews',
      body: [
        'Arrive on time, communicate clearly and finish the job as agreed. Reviews follow.',
      ],
    },
  ],
  cta: { label: 'Become a provider', href: '/providers/join' },
};

export const sitemapGroups: {
  heading: string;
  links: { label: string; href: string }[];
}[] = [
  {
    heading: 'Customers',
    links: [
      { label: 'Home', href: '/' },
      { label: 'Explore services', href: '/explore' },
      { label: 'Gift cards', href: '/gift-cards' },
      { label: 'Help centre', href: '/help' },
      { label: 'Contact us', href: '/contact' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { label: 'Sign in', href: '/sign-in' },
      { label: 'Create account', href: '/sign-up' },
      { label: 'Bookings', href: '/account/bookings' },
      { label: 'Saved providers', href: '/account/saved' },
      { label: 'Reviews', href: '/account/reviews' },
      { label: 'Settings', href: '/account/settings' },
    ],
  },
  {
    heading: 'Providers',
    links: [
      { label: 'Become a provider', href: '/providers/join' },
      { label: 'Provider log in', href: '/providers/sign-in' },
      { label: 'Resources', href: '/providers/resources' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About Pebble', href: '/about' },
      { label: 'Careers', href: '/careers' },
      { label: 'Press', href: '/press' },
      { label: 'Blog', href: '/blog' },
      { label: 'Trust and safety', href: '/safety' },
      { label: 'Cancellation policy', href: '/cancellation-policy' },
      { label: 'Terms of use', href: '/terms' },
      { label: 'Privacy policy', href: '/privacy' },
    ],
  },
];
