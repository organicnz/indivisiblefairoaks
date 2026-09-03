import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/wishlist' },
  title: 'Wishlist | Catch-22 New Zealand',
  description: 'Gear you have saved for later at Catch-22.',
};

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
