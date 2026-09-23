import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account | Indivisible Fair Oaks-Carmichael',
  description: 'Manage your Indivisible Fair Oaks-Carmichael member account.',
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
