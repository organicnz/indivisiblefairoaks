import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/wishlist' },
  title: 'Saved Items | Indivisible Fair Oaks-Carmichael',
  description: 'Items and resources you have saved for later.',
};

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
