import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/privacy-policy' },
  title: 'Privacy Policy | Indivisible Fair Oaks-Carmichael',
  description:
    'How Indivisible Fair Oaks-Carmichael collects, uses, and protects your personal information.',
};

export default function PrivacyPolicyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
