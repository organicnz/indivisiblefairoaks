import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/contact' },
  title: 'Contact Us | Indivisible Fair Oaks-Carmichael',
  description:
    'Get in touch with Indivisible Fair Oaks-Carmichael. Join our committees, connect with leadership, or get involved with local civic activism.',
  openGraph: {
    title: 'Contact Us | Indivisible Fair Oaks-Carmichael',
    description:
      'Get in touch with Indivisible Fair Oaks-Carmichael. Join our committees, connect with leadership, or get involved with local civic activism.',
    url: 'https://indivisiblefairoaks.org/contact',
    siteName: 'Indivisible Fair Oaks-Carmichael',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Us | Indivisible Fair Oaks-Carmichael',
    description:
      'Get in touch with Indivisible Fair Oaks-Carmichael. Join our committees, connect with leadership, or get involved with local civic activism.',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
