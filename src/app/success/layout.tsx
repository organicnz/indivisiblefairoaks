import type { Metadata } from 'next';
import { privateMetadata } from '@/lib/metadata';

// Order confirmation carries per-session data — never index it (mirrors the
// X-Robots-Tag noindex in next.config.ts and the /search page pattern).
export const metadata: Metadata = privateMetadata({
  title: 'Order Confirmed',
  description:
    'Your order has been confirmed. Thank you for supporting Indivisible Fair Oaks-Carmichael.',
  path: '/success',
});

export default function SuccessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
