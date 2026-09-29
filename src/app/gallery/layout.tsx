import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Community Gallery',
  description:
    'Community gallery of rallies, singing protests, chapter meetings, and grassroots actions across Sacramento County.',
  path: '/gallery',
});

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
