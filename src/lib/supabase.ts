import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

export const createClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createBrowserClient<Database>(url, key);
};

/**
 * Returns a public URL for an asset stored in Supabase Storage.
 */
export function getStorageUrl(path: string | null, bucket = 'media'): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;

  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const baseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mojsubkqjdruhpxbzgme.supabase.co';
  return `${baseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
}
