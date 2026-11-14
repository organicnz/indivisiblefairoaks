// Single source of truth for primary navigation.
//
// The nav was declared inline in Header.tsx and rendered twice (desktop row +
// mobile drawer) with no `aria-current`, so the active page was conveyed by amber
// text alone — invisible to a screen reader and to anyone who cannot distinguish
// the colour. Deriving both surfaces from one list makes the active state a
// property of the data rather than something each render has to remember.

export type NavGroup = 'act' | 'community' | 'chapter' | 'more';

export type NavLink = {
  label: string;
  /**
   * Concise label for the horizontal desktop row. The full label is used in the
   * drawer and wherever there is room.
   */
  short?: string;
  href: string;
  /**
   * Task group used by the drawer and by the desktop ordering. Home is the
   * logo, not a nav item; eight entries plus Donate is the readable limit.
   */
  group?: NavGroup;
  /**
   * Extra path prefixes that should also mark this link active. A link is active
   * when the current path is the href itself or sits under one of these prefixes.
   */
  matchPrefixes?: readonly string[];
  /**
   * Dropdown children. A link with children renders as a dropdown trigger on
   * desktop and as an expanded group in the mobile drawer — both derived from
   * this list, so the two surfaces cannot drift.
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

export const NAV_GROUPS: readonly { id: NavGroup; label: string }[] = [
  { id: 'act', label: 'Take Action' },
  { id: 'community', label: 'Community' },
  { id: 'chapter', label: 'The Chapter' },
  { id: 'more', label: 'Explore' },
] as const;

export const ROUTES: readonly NavLink[] = [
  {
    label: 'About',
    short: 'About',
    href: '/about',
    group: 'chapter',
  },
  {
    label: 'Events & Actions',
    short: 'Events',
    href: '/events',
    group: 'act',
  },
  {
    label: 'ICE Activity Alerts',
    short: 'ICE Alerts',
    href: '/ice-alerts',
    group: 'act',
  },
  {
    label: 'Voter Info',
    short: 'Voter Info',
    href: '/voter-info',
    group: 'act',
    // First entry is the overview page itself so every existing link to
    // `/voter-info` keeps working; anchors below match `id`s in the page.
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
  {
    label: 'Resistance Choir',
    short: 'Choir',
    href: '/choir',
    group: 'community',
  },
  {
    label: 'News & Updates',
    short: 'News',
    href: '/news',
    group: 'community',
  },
  {
    label: 'Contact',
    short: 'Contact',
    href: '/contact',
    group: 'chapter',
  },
  {
    label: 'Explore',
    short: 'Explore',
    href: '/gallery',
    group: 'more',
    matchPrefixes: ['/gallery', '/links', '/archive', '/faqs', '/partners'],
    children: [
      { label: 'Gallery', href: '/gallery' },
      { label: 'Coalition Links', href: '/links' },
      { label: 'Chapter Archive', href: '/archive' },
      { label: 'Frequently Asked Questions', href: '/faqs' },
      { label: 'Coalition Partners', href: '/partners' },
    ],
  },
] as const;

/** Compact subset for the 404 page, where a wall of links would be noise. */
export const NOT_FOUND_ROUTES: readonly NavLink[] = [
  { label: 'About us', href: '/about' },
  { label: 'Events & Actions', href: '/events' },
  { label: 'ICE Activity Alerts', href: '/ice-alerts' },
  { label: 'Voter Info', href: '/voter-info' },
  { label: 'News', href: '/news' },
  { label: 'Gallery', href: '/gallery' },
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
