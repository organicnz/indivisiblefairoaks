import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/gallery' },
  title: 'Community Gallery | Indivisible Fair Oaks-Carmichael',
  description:
    'Community gallery of rallies, singing protests, chapter meetings, and grassroots actions across Sacramento County.',
};

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
