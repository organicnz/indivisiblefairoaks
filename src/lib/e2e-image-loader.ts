import type { ImageLoaderProps } from 'next/image';

/**
 * E2E-only image loader.
 *
 * The browser suite runs on CI runners whose path to Supabase Storage is slow
 * enough that the image optimizer's upstream fetch times out. Every `load`
 * event then waits on an image that never arrives, and the suite fails before
 * it has tested the page. The repository already ships the gallery photos the
 * suite needs, so this loader maps remote media to those local files.
 *
 * It returns the fixture path directly, **not** a `/_next/image` URL. Next
 * disables its image optimizer endpoint when `images.loader` is `custom`, so
 * wrapping the local path in `/_next/image` returned the 404 page for every
 * photo; each `<Image>` fired `onError` and every gallery card rendered its
 * fallback plate. The browser suite must see the real fixtures, and the
 * accessibility gate must measure the caption over a photo rather than over a
 * placeholder.
 *
 * `e2e/core-journeys.spec.ts` intercepts `**\/images/gallery/**` to prove the
 * accessible fallback still appears when a photo genuinely fails.
 *
 * This file is wired in only when `NEXT_E2E_BUILD=true`; production uses
 * Next's default loader and the real Supabase images.
 */
const LOCAL_GALLERY = new Set([
  'carmichael-resistance-choir.jpg',
  'norcal-resist-brake-light-clinic.jpg',
  'sacramento-capitol-no-kings.jpg',
  'sacramento-tower-bridge-march.jpg',
  'witty-ikea-sign.jpg',
  'witty-introverts-sign.jpg',
]);

const FALLBACK = '/images/gallery/sacramento-capitol-no-kings.jpg';

export default function e2eImageLoader({ src }: ImageLoaderProps): string {
  if (src.startsWith('data:') || src.startsWith('blob:') || src.endsWith('.svg')) {
    return src;
  }

  try {
    const url = new URL(src, 'https://e2e.invalid');
    if (url.pathname.startsWith('/images/')) {
      return url.pathname;
    }
    if (url.pathname.includes('/storage/v1/object/public/media/gallery/')) {
      const name = url.pathname.split('/').pop() ?? '';
      return LOCAL_GALLERY.has(name) ? `/images/gallery/${name}` : FALLBACK;
    }
    if (src.startsWith('/')) {
      return src;
    }
  } catch {
    // A malformed URL still gets a deterministic local image.
  }

  return FALLBACK;
}
