import type { Metadata } from 'next';
import { ContactForm } from '@/components/layout/contact-form';
import { PageFrame, PageHeading } from '@/components/layout/info-page';

export const metadata: Metadata = { title: 'Contact us' };

export default function ContactPage() {
  return (
    <PageFrame>
      <PageHeading
        title="Contact us"
        intro="Questions, feedback or a problem with a booking? Send us a message."
      />
      <ContactForm />
    </PageFrame>
  );
}
