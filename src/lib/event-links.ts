/** The public events page anchor used by every quick-hit destination. */
export const EVENT_CALENDAR_HREF = '/events#upcoming-events';

/**
 * Deep link to the upcoming-events calendar with one category selected.
 *
 * The calendar reads `category` after hydration, so the query param is both a
 * working filter and a shareable URL. `All Actions` is the unfiltered state and
 * therefore has no query param.
 */
export function eventCategoryHref(category: string): string {
  if (!category || category === 'All Actions') return EVENT_CALENDAR_HREF;
  return `/events?category=${encodeURIComponent(category)}#upcoming-events`;
}
