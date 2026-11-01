/**
 * The editing address, kept honest.
 *
 * `?region=home-hero` is how a copy region is addressed: it is a slice of a
 * coded page, not a path, so there is nothing else in the URL to point at. The
 * overlay validated that parameter when it arrived, but every subsequent
 * switch — the sidebar's region tabs, "Whole page" — lived only in React state.
 * A refresh dropped the admin back on the whole-page document, and the address
 * bar disagreed with what they were editing.
 *
 * These helpers own the URL half. They deliberately use `replaceState`: the
 * region is a lens over the same document, not a navigation, so switching one
 * must not fill the back button with editor state.
 */

export const VISUAL_EDIT_REGION_PARAM = 'region';

/**
 * The query string with the region set or removed.
 *
 * Every other parameter survives — an admin mid-filter should not lose the
 * filter because they switched regions — and a null region removes the key
 * rather than writing `region=` (which the overlay would read as an id).
 */
export function withRegionParam(search: string, regionId: string | null): string {
  const params = new URLSearchParams(search);
  if (regionId) params.set(VISUAL_EDIT_REGION_PARAM, regionId);
  else params.delete(VISUAL_EDIT_REGION_PARAM);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * Mirror the active region into the address bar without navigating.
 *
 * A no-op when the address already says this — `replaceState` on every render
 * is a history implementation detail, but a same-URL write still has a cost and
 * makes the call site's intent less clear than an explicit comparison.
 */
export function syncRegionParamInUrl(regionId: string | null): void {
  if (typeof window === 'undefined') return;
  const { pathname, search, hash } = window.location;
  const nextSearch = withRegionParam(search, regionId);
  if (nextSearch === search) return;
  window.history.replaceState(window.history.state, '', `${pathname}${nextSearch}${hash}`);
}
