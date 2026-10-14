/**
 * Civic data fetchers safe to call from Client Components.
 * Fetches directly through Edge API routes without exposing database clients to the browser.
 */
export async function getTickerEvents(): Promise<
  { label: string; detail: string; href: string; badge: string }[]
> {
  try {
    const res = await fetch('/api/civic/events');
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.events)) {
        return json.events.map(
          (e: { title: string; dateLabel: string; timeLabel: string; category: string }) => ({
            label: e.title,
            detail: `${e.dateLabel} • ${e.timeLabel}`,
            href: '/events',
            badge: e.category,
          })
        );
      }
    }
  } catch (err) {
    console.error('Error fetching ticker events via Edge API:', err);
  }
  return [];
}
