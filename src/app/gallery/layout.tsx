import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/gallery' },
  title: 'Catch Snaps | Catch-22 New Zealand',
  description:
    'Community gallery of Catch-22 braid, lures and gear in action — real catches from NZ waters.',
};

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
