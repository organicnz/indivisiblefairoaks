import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/login' },
  title: 'Sign In | Indivisible Fair Oaks-Carmichael',
  description: 'Sign in to your member account.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
