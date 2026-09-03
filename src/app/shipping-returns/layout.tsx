import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/shipping-returns' },
  title: 'Shipping & Returns | Catch-22 New Zealand',
  description:
    'Fast NZ shipping on all Catch-22 orders. 30-day returns and our tackle-faulty guarantee.',
};

export default function ShippingReturnsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
