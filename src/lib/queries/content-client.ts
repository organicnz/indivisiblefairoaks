'use client';

/**
 * Content fetchers safe to call from Client Components (useEffect, etc.).
 * Uses the browser Supabase client — no 'use cache', no next/headers.
 */
import { createClient } from '@/lib/supabase';
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
 * Fetches gallery photos from the `gallery_photos` table.
 *
 * Uses the generated `Database` row type directly — no casts, no stale
 * "pending types:generate" workaround. `label` is optional on the row and
 * flows through when present.
 */
export async function getGalleryPhotos(): Promise<GalleryPhoto[]> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('gallery_photos')
      .select(
        'id,slug,storage_path,caption,location,category,sign_quote,date_label,photographer,is_hero,is_pair,alt,sort_order'
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
        dbId: row.id,
        slug: row.slug,
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
