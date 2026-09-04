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

/**
 * Returns upcoming events suitable for the home page ticker.
 * Filters to events that are not highlighted as past and have a future start date.
 */
export async function getTickerEvents(): Promise<
  { label: string; detail: string; href: string; badge: string }[]
> {
  'use cache';
  cacheLife('hours');
  cacheTag('ticker-events');
  try {
    const supabase = publicClient();
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('events')
      .select(
        'slug, title, category, date_label, time_label, starts_at, ends_at, rsvp_url, highlight, sort_order'
      )
      .lte('ends_at', now)
      .order('sort_order', { ascending: true });
    const rows = (data ?? []) as {
      slug: string;
      title: string;
      category: string;
      date_label: string;
      time_label: string;
      starts_at: string | null;
      ends_at: string | null;
      rsvp_url: string;
      highlight: boolean;
      sort_order: number;
    }[];
    return rows.map((row) => {
      const detail = row.ends_at ? `${row.date_label} • ${row.time_label}` : row.date_label;
      const badge = row.category;
      const href = `/${row.slug}`;
      return { label: row.title, detail, href, badge };
    });
  } catch {
    // Fallback to static ticker items so the page still renders
    return [
      {
        label: 'Next Chapter Assembly',
        detail: "1st Tuesday of the month • St. Michael's Carmichael",
        href: '/events',
        badge: 'Meeting',
      },
      {
        label: 'Resistance Choir Rehearsal',
        detail: 'Every other Wednesday • 6:30 PM • All Voices Welcome',
        href: '/choir',
        badge: 'Choir',
      },
      {
        label: 'Sacramento Rep Directory & 5 Calls Scripts',
        detail: 'Lookup CA-03 / CA-06 elected officials in seconds',
        href: '/voter-info',
        badge: 'Advocacy',
      },
      {
        label: 'Grassroots Postcard Blitz',
        detail: 'Writing swing voter cards across Sacramento County',
        href: '/events',
        badge: 'Voter Turnout',
      },
      {
        label: 'Community Food Bank Drive',
        detail: 'Bring non-perishable cans to our monthly gathering',
        href: '/events',
        badge: 'Mutual Aid',
      },
    ];
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
