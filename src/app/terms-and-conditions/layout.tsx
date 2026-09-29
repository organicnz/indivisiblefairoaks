import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Terms & Conditions',
  description:
    'Terms of website use, community participation, and civic guidelines for Indivisible Fair Oaks-Carmichael.',
  path: '/terms-and-conditions',
});

export default function TermsAndConditionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
