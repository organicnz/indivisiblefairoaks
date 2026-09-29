'use client';

/**
 * Content fetchers safe to call from Client Components (useEffect, etc.).
 * Uses the browser Supabase client — no 'use cache', no next/headers.
 */
import { createClient } from '@/lib/supabase';

/**
 * Represents a gallery photo from the gallery_photos table.
 * The `url` field is set from the storage_path using the public Supabase Storage URL pattern.
 */
export interface GalleryPhoto {
  id: string;
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

// Raw DB row shape for gallery_photos. Auto-generated types don't include
// this table yet — pending the next `types:generate` run.
interface GalleryPhotoRow {
  slug: string;
  storage_path: string;
  caption: string | null;
  location: string | null;
  category: string | null;
  sign_quote: string | null;
  date_label: string | null;
  photographer: string | null;
  is_hero: boolean | null;
  is_pair: boolean | null;
  alt: string | null;
  sort_order: number | null;
}

/**
 * Fetches gallery photos from the gallery_photos table.
 *
 * Uses a cast to bypass auto-generated Supabase types — the table exists in
 * the DB (migration 20260904120000_gallery_photos.sql) but has not been
 * picked up by `types:generate` yet. Remove the cast after the next run.
 */
export async function getGalleryPhotos(): Promise<GalleryPhoto[]> {
  try {
    const supabase = createClient();

    // Cast needed until gallery_photos appears in auto-generated types.
    // The table exists in the DB (migration 20260904120000_gallery_photos.sql)
    // but has not been picked up by `types:generate` yet.
    const client = supabase as unknown as {
      from(t: string): {
        select(s: string): {
          order(
            c: string,
            o: { ascending: boolean }
          ): Promise<{ data: GalleryPhotoRow[] | null; error: { message: string } | null }>;
        };
      };
    };
    const { data, error } = await client
      .from('gallery_photos')
      .select(
        'slug,storage_path,caption,location,category,sign_quote,date_label,photographer,is_hero,is_pair,alt,sort_order'
      )
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching gallery photos from Supabase:', error.message);
      return [];
    }

    if (!data || data.length === 0) return [];

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://mojsubkqjdruhpxbzgme.supabase.co';

    return data.map((row): GalleryPhoto => {
      const storagePath = row.storage_path || '';
      const url = storagePath ? `${supabaseUrl}/storage/v1/object/public/media/${storagePath}` : '';

      return {
        id: row.slug,
        storage_path: storagePath,
        url,
        caption: row.caption ?? '',
        location: row.location ?? '',
        category: row.category ?? 'Other',
        signQuote: row.sign_quote ?? null,
        date: row.date_label
          ? (() => {
              const parsedDate = new Date(row.date_label);
              return Number.isNaN(parsedDate.getTime())
                ? row.date_label
                : parsedDate.toLocaleDateString('en-US');
            })()
          : '',
        photographer: row.photographer ?? 'Indivisible Fair Oaks Archive',
        is_hero: row.is_hero ?? false,
        is_pair: row.is_pair ?? false,
        alt: row.alt ?? '',
        sort_order: row.sort_order ?? undefined,
      };
    });
  } catch (err) {
    console.error('Unexpected error fetching gallery photos:', err);
    return [];
  }
}
