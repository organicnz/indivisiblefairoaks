import type { SupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import type { CivicEvent } from '@/components/ui/InteractiveEventsCalendar';
import { createPublicClient } from '@/lib/supabase-server';

// New civic tables predate the next `types:generate` run, so reads go through
// an untyped client and are narrowed to the row interfaces below.
function publicClient(): SupabaseClient {
  return createPublicClient() as unknown as SupabaseClient;
}

interface EventRow {
  slug: string;
  title: string;
  category: string;
  date_label: string;
  time_label: string;
  starts_at: string | null;
  ends_at: string | null;
  location_name: string;
  address: string;
  description: string;
  rsvp_url: string;
  highlight: boolean | null;
  sort_order: number;
}

export interface PartnerRow {
  slug: string;
  name: string;
  category: string;
  description: string;
  url: string;
  sort_order: number;
}

export interface CoalitionLinkRow {
  slug: string;
  name: string;
  category: string;
  url: string;
  description: string;
  badge: string | null;
  sort_order: number;
}

export interface NewsletterRow {
  slug: string;
  title: string;
  date_label: string;
  description: string;
  topics: string[];
  sort_order: number;
}

/** Basic-format stamp (YYYYMMDDTHHMMSS) for Google Calendar / ICS export. */
function toBasicFormat(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export async function getEvents(): Promise<CivicEvent[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('events');
  try {
    const supabase = publicClient();
    const { data } = await supabase
      .from('events')
      .select(
        'slug, title, category, date_label, time_label, starts_at, ends_at, location_name, address, description, rsvp_url, highlight, sort_order'
      )
      .order('sort_order', { ascending: true });
    const rows = (data ?? []) as EventRow[];
    return rows.map((row) => ({
      id: row.slug,
      title: row.title,
      category: row.category as CivicEvent['category'],
      dateLabel: row.date_label,
      timeLabel: row.time_label,
      isoDateStart: toBasicFormat(row.starts_at),
      isoDateEnd: toBasicFormat(row.ends_at),
      locationName: row.location_name,
      address: row.address,
      description: row.description,
      rsvpUrl: row.rsvp_url,
      highlight: row.highlight ?? undefined,
    }));
  } catch {
    return [];
  }
}

export async function getPartners(): Promise<PartnerRow[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('partners');
  try {
    const supabase = publicClient();
    const { data } = await supabase
      .from('partners')
      .select('slug, name, category, description, url, sort_order')
      .order('sort_order', { ascending: true });
    return (data ?? []) as PartnerRow[];
  } catch {
    return [];
  }
}

export async function getCoalitionLinks(): Promise<CoalitionLinkRow[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('coalition-links');
  try {
    const supabase = publicClient();
    const { data } = await supabase
      .from('coalition_links')
      .select('slug, name, category, url, description, badge, sort_order')
      .order('sort_order', { ascending: true });
    return (data ?? []) as CoalitionLinkRow[];
  } catch {
    return [];
  }
}

export async function getNewsletters(): Promise<NewsletterRow[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('newsletters');
  try {
    const supabase = publicClient();
    const { data } = await supabase
      .from('newsletters')
      .select('slug, title, date_label, description, topics, sort_order')
      .order('sort_order', { ascending: true });
    const rows = (data ?? []) as NewsletterRow[];
    return rows.map((row) => ({
      ...row,
      topics: Array.isArray(row.topics) ? row.topics : [],
    }));
  } catch {
    return [];
  }
}

export interface GalleryPhotoRow {
  id: number;
  slug: string;
  storage_path: string;
  alt: string;
  caption: string;
  location: string;
  category: string;
  sign_quote: string | null;
  date_label: string;
  photographer: string;
  is_hero: boolean;
  is_pair: boolean;
  sort_order: number;
}

export async function getGalleryPhotos(): Promise<GalleryPhotoRow[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('gallery');
  try {
    const supabase = publicClient();
    const { data } = await supabase
      .from('gallery_photos')
      .select(
        'id, slug, storage_path, alt, caption, location, category, sign_quote, date_label, photographer, is_hero, is_pair, sort_order'
      )
      .order('sort_order', { ascending: true });
    return (data ?? []) as GalleryPhotoRow[];
  } catch {
    return [];
  }
}
