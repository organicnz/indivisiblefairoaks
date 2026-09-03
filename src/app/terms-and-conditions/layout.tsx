import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/terms-and-conditions' },
  title: 'Terms & Conditions | Indivisible Fair Oaks-Carmichael',
  description:
    'Terms of website use, community participation, and civic guidelines for Indivisible Fair Oaks-Carmichael.',
};

export default function TermsAndConditionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
