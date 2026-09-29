import type { MetadataRoute } from 'next';
import { BRAND } from '@/config/brand';
import { SITE_DESCRIPTION, SITE_NAME } from '@/config/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: SITE_NAME,
    short_name: 'Indivisible FOC',
    description: SITE_DESCRIPTION,
    start_url: '/',
    // Pin the install identity and scope so an update never forks a second
    // installed copy under a different URL.
    scope: '/',
    lang: 'en-US',
    dir: 'ltr',
    display: 'standalone',
    orientation: 'portrait-primary',
    categories: ['politics', 'news', 'social'],
    // Both from the token palette. These previously read '#020617' and '#0f172a',
    // which are not the same colour — the splash background and the toolbar
    // rendered visibly different on launch.
    background_color: BRAND.surfaceDark,
    theme_color: BRAND.surfaceDark,
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/favicon.ico', sizes: '64x64', type: 'image/x-icon' },
      { src: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      // Genuinely maskable: the mark is inset to the inner 80% safe zone on an
      // opaque field. The old manifest pointed `purpose: 'maskable'` at the same
      // unclipped 512px artwork, so Android's adaptive-icon crop sliced the emblem.
      {
        src: '/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'Donate', url: '/donate' },
      { name: 'Events & Actions', url: '/events' },
      { name: 'Contact Us', url: '/contact' },
    ],
  };
}
