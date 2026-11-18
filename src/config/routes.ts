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
   * Concise label for the horizontal desktop row. The full label is used in the
   * drawer and wherever there is room.
   */
  short?: string;
  href: string;
  /**
   * Desktop header placement. Omitted routes render in the primary row;
   * `alert` gives the route its own labeled navigation landmark.
   */
  placement?: 'alert';
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

export const ROUTES: readonly NavLink[] = [
  // The explicit Home tab. The logo still links home, but the primary row
  // starts with a readable Main entry so the landing page is discoverable.
  {
    label: 'Main',
    short: 'Main',
    href: '/',
  },
  {
    label: 'About',
    short: 'About',
    href: '/about',
  },
  {
    label: 'Events & Actions',
    short: 'Events',
    href: '/events',
  },
  {
    label: 'ICE Alert',
    short: 'ICE Alert',
    href: '/ice-alerts',
    // Keep the alert in its own desktop utility landmark while retaining its
    // position in the mobile drawer's ROUTES order.
    placement: 'alert',
  },
  {
    label: 'Voter Info',
    short: 'Voter Info',
    href: '/voter-info',
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
  },
  {
    label: 'News & Updates',
    short: 'News',
    href: '/news',
    matchPrefixes: ['/newsletters'],
    children: [
      { label: 'News & Updates', href: '/news' },
      { label: 'Newsletters', href: '/newsletters' },
    ],
  },
  {
    label: 'Contact',
    short: 'Contact',
    href: '/contact',
  },
  {
    label: 'Explore',
    short: 'Explore',
    href: '/gallery',
    matchPrefixes: ['/gallery', '/links', '/archive', '/faqs', '/partners'],
    children: [
      { label: 'Gallery', href: '/gallery' },
      { label: 'Link Tree', href: '/links' },
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
  { label: 'ICE Alert', href: '/ice-alerts' },
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

export type HeaderNavigation = {
  readonly primaryRoutes: readonly NavLink[];
  readonly alertRoute: NavLink;
};

/**
 * Split the route list into the desktop header's two landmarks.
 *
 * Exactly one route must opt into the alert placement. Failing loudly is
 * deliberate: the ICE Alert entry is safety-critical, and a missing or
 * duplicated placement must never silently remove it from the header.
 */
export function getHeaderNavigation(
  routes: readonly NavLink[] = ROUTES
): HeaderNavigation {
  const alertRoutes = routes.filter((route) => route.placement === 'alert');
  const [alertRoute, ...extraAlertRoutes] = alertRoutes;

  if (!alertRoute || extraAlertRoutes.length > 0) {
    throw new Error(
      `Expected exactly one route with placement "alert", found ${alertRoutes.length}.`
    );
  }

  return {
    alertRoute,
    primaryRoutes: routes.filter((route) => route.placement !== 'alert'),
  };
}
