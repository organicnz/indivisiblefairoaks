import type { TickerItem } from '@/components/ui/CivicActionTicker';
import { gatheringCard, type GatheringCard } from '@/lib/civic-events';
import { getDataPoints, getGalleryPhotos, getUpcomingEventData } from '@/lib/queries/civic';
import { getStorageUrl } from '@/lib/supabase';
import type { GalleryPhotoView } from '@/types/gallery';

export type HomePageData = {
  galleryPhotos: GalleryPhotoView[];
  tickerItems: TickerItem[];
  card: GatheringCard;
  dataPoints: Record<string, string>;
};

/**
 * Build the homepage view model in one place: gallery storage URLs, ticker
 * entries, the next-gathering card, and CMS data points. Keeping this out of
 * the page lets the page read as a composition of sections instead of a mix of
 * queries and presentation.
 */
export async function getHomePageData(): Promise<HomePageData> {
  // Server-side fetches cached via cacheTag and cacheLife in queries/civic.ts.
  // The upcoming-event cutoff is cached for a short window so this page stays
  // instant and does not call `new Date()` during a prerender.
  const [galleryRows, upcoming, dataPoints] = await Promise.all([
    getGalleryPhotos(),
    getUpcomingEventData(),
    getDataPoints('home'),
  ]);

  const galleryPhotos: GalleryPhotoView[] = galleryRows.map((row) => ({
    id: String(row.id),
    dbId: row.id,
    slug: row.slug,
    url: getStorageUrl(row.storage_path),
    alt: row.alt || row.caption,
    caption: row.caption,
    location: row.location,
    category: row.category,
    signQuote: row.sign_quote,
    date: row.date_label,
    photographer: row.photographer,
    is_hero: row.is_hero,
    is_pair: row.is_pair,
  }));

  // Issue #175: past one-off events belong in the archive. Recurring activity
  // stays visible, and the next meeting is selected by date rather than by the
  // first Meetings row in sort order. The still-upcoming December 1 fallback
  // covers a stale database until the next meeting is inserted through the
  // admin UI; after that date the card shows an honest TBD state.
  const upcomingEvents = upcoming.events;
  // Cap at 5 so the ticker doesn't overflow on small screens.
  const tickerItems: TickerItem[] = upcomingEvents.slice(0, 5).map((event) => ({
    label: event.title,
    detail: `${event.dateLabel} • ${event.timeLabel}`,
    href: '/events',
    badge: event.category,
  }));

  // Dynamic gathering card (issue #37): the meeting row drives the alert card,
  // so the events table — not JSX — is where the next meeting gets updated.
  const card = gatheringCard(upcoming.nextMeeting, upcoming.fallbackMeeting);

  return { galleryPhotos, tickerItems, card, dataPoints };
}
