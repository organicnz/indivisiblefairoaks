'use client';

/**
 * Content fetchers safe to call from Client Components (useEffect, etc.).
 * Fetches directly through Edge API routes without exposing database clients to the browser.
 */
import type { Database } from '@/types/supabase';

/** Raw DB row — the canonical `gallery_photos` row (has `id: number` + `slug`). */
export type GalleryPhotoRow = Database['public']['Tables']['gallery_photos']['Row'];

/**
 * Gallery photo with its `storage_path` resolved to a public URL.
 *
 * `id` stays the `slug` string the gallery UI keys on; `dbId` carries the
 * numeric PK for joins. `storage_path` is kept (the view type omits it) so
 * the uploader and the visual editor can ref-check before delete.
 */
export interface GalleryPhoto {
  id: string;
  dbId: number | null;
  slug: string;
  storage_path: string;
  url: string;
  caption: string;
  location: string;
  category: string;
  signQuote?: string | null;
  date: string;
  photographer: string;
  is_hero?: boolean;
  is_pair?: boolean;
  alt?: string;
  sort_order?: number;
  label?: string;
}

/**
 * Fetches gallery photos from the Supabase DB via the `/api/gallery` Edge API route.
 *
 * All data points are stored in Supabase and resolved server-side with CDN caching.
 */
export async function getGalleryPhotos(): Promise<GalleryPhoto[]> {
  try {
    const res = await fetch('/api/gallery');
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.photos)) {
        return json.photos.map(
          (p: {
            id?: string;
            dbId?: number | null;
            slug: string;
            url: string;
            caption?: string;
            location?: string;
            category?: string;
            signQuote?: string | null;
            date?: string;
            photographer?: string;
            is_hero?: boolean;
            is_pair?: boolean;
            alt?: string;
            sort_order?: number;
          }): GalleryPhoto => ({
            id: p.id || p.slug,
            dbId: p.dbId ?? null,
            slug: p.slug,
            storage_path: '',
            url: p.url,
            caption: p.caption ?? '',
            location: p.location ?? '',
            category: p.category ?? 'Other',
            signQuote: p.signQuote ?? null,
            date: p.date ?? '',
            photographer: p.photographer ?? 'Indivisible Fair Oaks Archive',
            is_hero: p.is_hero ?? false,
            is_pair: p.is_pair ?? false,
            alt: p.alt ?? '',
            sort_order: p.sort_order,
          })
        );
      }
    }
  } catch (err) {
    console.error('Error fetching gallery photos via Edge API:', err);
  }
  return [];
}
