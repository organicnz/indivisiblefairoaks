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
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('s3://')) {
    const withoutScheme = path.slice(5);
    const slashIndex = withoutScheme.indexOf('/');
    if (slashIndex !== -1) {
      const s3Bucket = withoutScheme.slice(0, slashIndex);
      const key = withoutScheme.slice(slashIndex + 1);
      return `https://${s3Bucket}.s3.amazonaws.com/${key}`;
    }
  }

  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return baseUrl ? `${baseUrl}/storage/v1/object/public/${bucket}/${cleanPath}` : `/${cleanPath}`;
}
