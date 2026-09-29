import type { Metadata } from 'next';
import { privateMetadata } from '@/lib/metadata';

export const metadata: Metadata = privateMetadata({
  title: 'Your Cart',
  description: 'Review your items and contributions before proceeding.',
  path: '/cart',
});

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
