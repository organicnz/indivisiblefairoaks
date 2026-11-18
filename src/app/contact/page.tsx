'use client';

import { ContactAside } from '@/components/contact/ContactAside';
import { ContactForm } from '@/components/contact/ContactForm';
import { ContactMasthead } from '@/components/contact/ContactMasthead';
import { CONTACT_DATA_POINT_DEFAULTS } from '@/components/contact/contact-copy';
import { useDataPoints } from '@/hooks/useDataPoints';

export default function ContactPage() {
  const { dataPoints } = useDataPoints('contact', CONTACT_DATA_POINT_DEFAULTS);

  return (
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance) transition-colors duration-300">
      <ContactMasthead dataPoints={dataPoints} />

      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 border border-border bg-surface-card p-6 sm:p-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
          <ContactForm dataPoints={dataPoints} />
          <ContactAside dataPoints={dataPoints} />
        </div>
      </div>
    </div>
  );
}
