/**
 * Civic data fetchers safe to call from Client Components (useEffect, etc.).
 * Uses the browser Supabase client — no 'use cache', no next/headers.
 */
import { createClient } from '@/lib/supabase';

export async function getTickerEvents(): Promise<
  { label: string; detail: string; href: string; badge: string }[]
> {
  try {
    const supabase = createClient();
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('events')
      .select('slug, title, category, date_label, time_label, ends_at')
      .gte('ends_at', now)
      .order('sort_order', { ascending: true });
    const rows = (data ?? []) as {
      slug: string;
      title: string;
      category: string;
      date_label: string;
      time_label: string;
      ends_at: string | null;
    }[];
    return rows.map((row) => ({
      label: row.title,
      detail: `${row.date_label} • ${row.time_label}`,
      href: '/events',
      badge: row.category,
    }));
  } catch {
    return [];
  }
}
