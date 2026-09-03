import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/contact' },
  title: 'Contact Us | Catch-22 New Zealand',
  description:
    'Get in touch with the Catch-22 team for questions about orders, gear recommendations, or partnership enquiries.',
  openGraph: {
    title: 'Contact Us | Catch-22 New Zealand',
    description:
      'Get in touch with the Catch-22 team for questions about orders, gear recommendations, or partnership enquiries.',
    url: 'https://catch-22.co.nz/contact',
    siteName: 'Catch-22',
    locale: 'en_NZ',
    type: 'website',
    images: [
      {
        url: 'https://wcoaqlglwxwceqktpckt.supabase.co/storage/v1/object/public/media/site/thunder-charter.jpg',
        width: 1200,
        height: 630,
        alt: 'Contact Catch-22 New Zealand',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Us | Catch-22 New Zealand',
    description:
      'Get in touch with the Catch-22 team for questions about orders, gear recommendations, or partnership enquiries.',
    images: [
      'https://wcoaqlglwxwceqktpckt.supabase.co/storage/v1/object/public/media/site/thunder-charter.jpg',
    ],
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
