import { privateMetadata } from '@/lib/metadata';

export const metadata = privateMetadata({
  title: 'Authentication',
  description: 'Secure member authentication for Indivisible Fair Oaks-Carmichael.',
});

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
