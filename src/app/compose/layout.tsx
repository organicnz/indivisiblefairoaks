import type { ReactNode } from 'react';

/**
 * The composer workspace is auth-gated and renders the site's own client chrome
 * (the header, the visual-edit overlay) around a row. Both read URL data with
 * `usePathname` / `useParams`, which cannot be prerendered, so the segment opts
 * out of blocking prerender at its root — the same opt-out `/admin` declares
 * for the same reason.
 *
 * It has to be a layout declaration, not the page's: the root layout's client
 * components sit above the page segment, and a page-level opt-out still let
 * them run in the prerender pass.
 */
export const instant = false;

export default function ComposeLayout({ children }: { children: ReactNode }) {
  return children;
}
