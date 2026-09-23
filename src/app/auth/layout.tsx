import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Authentication | Indivisible Fair Oaks-Carmichael',
  description: 'Secure member authentication for Indivisible Fair Oaks-Carmichael.',
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
