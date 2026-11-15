import type { GalleryPhoto } from '@/lib/queries/content-client';

/**
 * The authored alt text is the screen-reader description. The visible caption
 * is a fallback for older rows that predate the alt field, not a replacement
 * for it: captions are written for the page and can be too terse or too
 * contextual to describe the image on their own.
 */
export function galleryAltText(photo: Pick<GalleryPhoto, 'alt' | 'caption'>): string {
  return photo.alt?.trim() || photo.caption.trim() || 'Community photo';
}
