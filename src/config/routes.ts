// Single source of truth for primary navigation.
//
// The nav was declared inline in Header.tsx and rendered twice (desktop row +
// mobile drawer) with no `aria-current`, so the active page was conveyed by amber
// text alone — invisible to a screen reader and to anyone who cannot distinguish
// the colour. Deriving both surfaces from one list makes the active state a
// property of the data rather than something each render has to remember.

export type NavLink = {
  label: string;
  /**
   * Concise label for the horizontal desktop row, where all nine items sit on one
   * line. The full label is used in the drawer and wherever there is room.
   *
   * This is not cosmetic: at `tracking-[0.2em]` (the nav rule in AGENTS.md) the
   * full labels render a 1047px-wide row, which needs ~1700px of viewport once
   * the logo and action cluster are laid out. No standard breakpoint is that wide,
   * so the labels were wrapping at xl and overflowing outright at 1280.
   */
  short?: string;
  href: string;
  /**
   * Extra path prefixes that should also mark this link active. A link is active
   * when the current path is the href itself or sits under one of these prefixes —
   * without this, `/products/yard-sign` highlights nothing at all.
   */
  matchPrefixes?: readonly string[];
  /**
   * Dropdown children. A link with children renders as a dropdown trigger on
   * desktop and as an expanded group in the mobile drawer — both derived from
   * this list, so the two surfaces cannot drift. Currently only Voter Info has
   * children; it is the pilot for the pattern.
   */
  children?: readonly NavChild[];
};

/**
 * One dropdown entry. Internal entries are root-relative (page anchors included,
 * e.g. `/voter-info#guides`); external ones are absolute URLs and always render
 * as `target="_blank"` links that never carry the active state.
 */
export type NavChild = {
  label: string;
  href: string;
  external?: boolean;
};

export const ROUTES: readonly NavLink[] = [
  { label: 'Home', short: 'Home', href: '/' },
  { label: 'About', short: 'About', href: '/about' },
  { label: 'Events & Actions', short: 'Events', href: '/events' },
  { label: 'Resistance Choir', short: 'Choir', href: '/choir' },
  {
    label: 'Voter Info',
    short: 'Voter Info',
    href: '/voter-info',
    // Dropdown pilot (issue #78). First entry is the overview page itself so
    // every existing link to `/voter-info` keeps working; anchors below need
    // matching `id`s in `src/app/voter-info/page.tsx`, externals are the
    // official portals the page already links to.
    children: [
      { label: 'Voter Overview', href: '/voter-info' },
      { label: 'Register to Vote', href: 'https://registertovote.ca.gov', external: true },
      { label: 'Track Your Ballot', href: 'https://wheresmyballot.sos.ca.gov', external: true },
      {
        label: 'Sacramento Elections',
        href: 'https://elections.saccounty.gov',
        external: true,
      },
      { label: 'Find Your Representatives', href: '/voter-info#representatives' },
      { label: 'Voter Guides', href: '/voter-info#guides' },
      { label: 'Election Hotlines', href: '/voter-info#hotlines' },
    ],
  },
  { label: 'Gallery', short: 'Gallery', href: '/gallery' },
  { label: 'Newsletters', short: 'News', href: '/news' },
  { label: 'Coalition', short: 'Links', href: '/links' },
  { label: 'Contact', short: 'Contact', href: '/contact' },
] as const;

/** Compact subset for the 404 page, where a wall of links would be noise. */
export const NOT_FOUND_ROUTES: readonly NavLink[] = [
  { label: 'About us', href: '/about' },
  { label: 'Events & Actions', href: '/events' },
  { label: 'Voter Info', href: '/voter-info' },
  { label: 'News', href: '/news' },
  { label: 'Materials & Gear', href: '/products' },
] as const;

/**
 * Is this nav link the current page?
 *
 * `/` must match exactly — otherwise every route would highlight Home, since
 * `'/about'.startsWith('/')` is true.
 */
export function isActiveRoute(pathname: string, link: NavLink): boolean {
  if (link.href === '/') return pathname === '/';
  if (pathname === link.href) return true;
  return (link.matchPrefixes ?? []).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
