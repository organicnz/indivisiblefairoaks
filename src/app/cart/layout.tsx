import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/cart' },
  title: 'Your Cart | Indivisible Fair Oaks-Carmichael',
  description: 'Review your items and contributions before proceeding.',
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
