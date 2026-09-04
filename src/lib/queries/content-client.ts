/**
 * Content fetchers safe to call from Client Components (useEffect, etc.).
 * Uses the browser Supabase client — no 'use cache', no next/headers.
 */
import { createClient } from '@/lib/supabase';

/**
 * Represents a gallery photo from the gallery_photos table.
 * The `url` field is expected to be set by the caller via getStorageUrl(storage_path).
 */
export interface GalleryPhoto {
  id: string; // slug
  storage_path: string; // relative path in the 'media' bucket (e.g. 'gallery/foo.jpg')
  url: string; // full Supabase Storage URL (set via getStorageUrl)
  caption: string;
  location: string;
  category: string;
  signQuote?: string | null;
  date: string;
  photographer: string;
  is_hero?: boolean;
  is_pair?: boolean;
  alt?: string;
}

/**
 * Fetches gallery photos from the dedicated gallery_photos table (single source of truth).
 * Each row has a storage_path (relative path in the 'media' bucket) that is
 * converted to a full Supabase Storage URL via getStorageUrl() in the caller.
 *
 * Returns an array of GalleryPhoto objects ready for render.
 * Falls back gracefully if the table is not available or query fails.
 *
 * Note: Uses the Supabase browser client. The gallery_photos table exists in the
 * database via migration 20260904120000_gallery_photos.sql but may not be in the
 * auto-generated TypeScript types. The query uses a type assertion to bypass this.
 */
export async function getGalleryPhotos(): Promise<GalleryPhoto[]> {
  try {
    const supabase = createClient();
    // Use unknown as intermediate type to bypass strict table-typing, then cast
    const { data, error } = (await supabase
      .from('gallery_photos' as any)
      .select('*,photographer')
      .order('sort_order', { ascending: true })) as { data: any; error: any };

    if (error) {
      console.error('Error fetching gallery photos from Supabase:', error);
      return [];
    }

    if (data && data.length > 0) {
      return data.map((row: any) => {
        // Build the full Supabase Storage URL from the relative storage_path
        const storagePath = row.storage_path || '';
        const url = storagePath
          ? `https://${process.env.NEXT_PUBLIC_SUPABASE_URL || 'mojsubkqjdruhpxbzgme.supabase.co'}/storage/v1/object/public/media/${storagePath}`
          : '';

        // Extract photographer - use the row's photographer field
        const photographer = row.photographer || 'Indivisible Fair Oaks Archive';

        return {
          id: row.slug,
          storage_path: storagePath,
          url,
          caption: row.caption || '',
          location: row.location || '',
          category: row.category || 'Other',
          signQuote: row.sign_quote ?? null,
          date: row.date_label ? new Date(row.date_label).toLocaleDateString('en-US') : '',
          photographer: photographer,
          is_hero: row.is_hero ?? false,
          is_pair: row.is_pair ?? false,
          alt: row.alt || '',
        } as GalleryPhoto;
      });
    }
    return [];
  } catch (err) {
    console.error('Unexpected error fetching gallery photos:', err);
    return [];
  }
}
