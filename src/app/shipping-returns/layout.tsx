import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/shipping-returns' },
  title: 'Shipping & Delivery Policy | Indivisible Fair Oaks-Carmichael',
  description:
    'Information regarding material delivery, rally supplies, and distribution policies for Indivisible Fair Oaks-Carmichael.',
};

export default function ShippingReturnsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
