import type { Metadata } from 'next';
import { privateMetadata } from '@/lib/metadata';

export const metadata: Metadata = privateMetadata({
  title: 'Sign In',
  description: 'Sign in to your member account.',
  path: '/login',
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
