import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/login' },
  title: 'Sign In | Catch-22 New Zealand',
  description: 'Sign in to your Catch-22 account.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
