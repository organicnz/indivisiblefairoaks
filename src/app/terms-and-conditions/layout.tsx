import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/terms-and-conditions' },
  title: 'Terms & Conditions | Catch-22 New Zealand',
  description: 'Terms of sale, website use, and product information for Catch-22 fishing gear.',
};

export default function TermsAndConditionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
