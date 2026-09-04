/**
 * Content fetchers safe to call from Client Components (useEffect, etc.).
 * Uses the browser Supabase client — no 'use cache', no next/headers.
 */
import { createClient } from '@/lib/supabase';

export async function getGalleryPhotos() {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('content')
      .select('slug, title, created_at')
      .eq('status', 'publish')
      .eq('type', 'gallery');
    if (data && data.length > 0) {
      return data.map((row) => ({
        id: row.slug,
        url: '',
        caption: row.title,
        location: '',
        category: 'No Kings Sacramento' as const,
        signQuote: undefined,
        date: row.created_at ? new Date(row.created_at).toLocaleDateString('en-US') : '',
        photographer: 'Indivisible Fair Oaks Archive',
      }));
    }
    return [];
  } catch {
    return [];
  }
}

export async function getTestimonials() {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('content')
      .select('slug, title, body')
      .eq('status', 'publish')
      .eq('type', 'testimonial');
    if (data && data.length > 0) {
      return data.map((row) => ({
        name: row.title.split(' - ')[0] || 'Unknown',
        role: 'Contributor',
        content: row.body || '',
        image: '',
        stars: 5,
      }));
    }
    return null;
  } catch {
    return null;
  }
}
