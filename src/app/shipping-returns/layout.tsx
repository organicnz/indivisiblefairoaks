import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Shipping & Delivery Policy',
  description:
    'Information regarding material delivery, rally supplies, and distribution policies for Indivisible Fair Oaks-Carmichael.',
  path: '/shipping-returns',
});

export default function ShippingReturnsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
