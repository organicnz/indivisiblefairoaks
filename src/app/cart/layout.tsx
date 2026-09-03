import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/cart' },
  title: 'Your Cart | Catch-22 New Zealand',
  description: 'Review your Catch-22 cart before checkout.',
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
