import { privateMetadata } from '@/lib/metadata';

export const metadata = privateMetadata({
  title: 'Account',
  description: 'Manage your Indivisible Fair Oaks-Carmichael member account.',
});

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
