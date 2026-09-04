import type { Metadata } from 'next';

// Order confirmation carries per-session data — never index it (mirrors the
// X-Robots-Tag noindex in next.config.ts and the /search page pattern).
export const metadata: Metadata = {
  alternates: { canonical: '/success' },
  title: 'Order Confirmed | Indivisible Fair Oaks-Carmichael',
  description:
    'Your order has been confirmed. Thank you for supporting Indivisible Fair Oaks-Carmichael.',
  robots: { index: false, follow: true },
};

export default function SuccessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
