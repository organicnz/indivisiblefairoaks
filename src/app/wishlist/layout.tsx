import type { Metadata } from 'next';
import { privateMetadata } from '@/lib/metadata';

export const metadata: Metadata = privateMetadata({
  title: 'Saved Items',
  description: 'Items and resources you have saved for later.',
  path: '/wishlist',
});

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
