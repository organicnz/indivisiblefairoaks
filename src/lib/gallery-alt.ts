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

/**
 * The visible caption for a card or lightbox title. The authored caption wins
 * because it is the public label; alt text is the fallback for older rows, and
 * "Community photo" is the final non-empty fallback. Radix uses this text as
 * `Dialog.Title`, so returning an empty string would leave the photo viewer
 * unnamed for assistive technology.
 */
export function galleryCaption(photo: Pick<GalleryPhoto, 'alt' | 'caption'>): string {
  return photo.caption.trim() || galleryAltText(photo);
}
