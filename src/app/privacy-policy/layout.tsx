import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/privacy-policy' },
  title: 'Privacy Policy | Catch-22 New Zealand',
  description: 'How Catch-22 collects, uses, and protects your personal information.',
};

export default function PrivacyPolicyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
