'use client';

import { PenLine } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEditContext } from './useEditContext';
import { useVisualEditMode } from './visual-edit-store';

/**
 * Admin-only editorial entry point in the site header.
 *
 * It is a **toggle**, not a link: it turns the site's visual editing mode on and
 * off, which is what makes the rest of the surface — the section list on a CMS
 * page — appear at all. The link to the full editor lives beside it in the
 * drawer, and on the overlay the mode itself opens.
 *
 * Renders only when the current pathname resolves to a real edit URL. A control
 * with nowhere to go is a fake control, so on every other page, and for every
 * non-admin, this renders nothing at all. While resolving it holds an
 * exact-size skeleton, so an admin signing in causes no layout shift. Hidden
 * below `sm`: the action cluster is already tight at 320px, and the nav drawer
 * carries both destinations as full-width rows there.
 *
 * The two states are distinguished by more than colour — `aria-pressed` carries
 * it, and the on-state adds a ring — because "is visual editing on?" is a
 * question an admin must be able to answer from the button alone, and the mode
 * governs whether clicks on the page do anything.
 */
export function EditorialButton() {
  const pathname = usePathname();
  const { loading, isAdmin, target } = useEditContext(pathname ?? '/');
  const { enabled, toggle } = useVisualEditMode(pathname ?? '/');

  if (loading) {
    return (
      <span aria-hidden="true" className="hidden sm:inline-block size-11 rounded-lg bg-white/10" />
    );
  }

  if (!isAdmin) return null;

  const tooltip = enabled
    ? `Visual editing is ON${target ? ` for ${target.label}` : ''} — click to turn off`
    : `Turn on visual editing${target ? ` for ${target.label}` : ' for this page'}`;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      data-testid="editorial-edit-button"
      title={tooltip}
      aria-label={tooltip}
      className={
        enabled
          ? 'hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-accent-gold/20 text-accent-gold ring-2 ring-accent-gold shadow-[0_0_15px_rgba(245,158,11,0.35)] transition-all duration-300 ease-out hover:bg-accent-gold/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-secondary'
          : 'hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl text-ink-on-dark border border-white/10 bg-white/5 hover:border-accent-gold/40 hover:bg-white/10 hover:text-white transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-secondary'
      }
    >
      <PenLine size={18} aria-hidden="true" className={enabled ? 'text-accent-gold' : ''} />
      <span className="hidden xl:inline text-xs font-bold uppercase tracking-wider">
        {enabled ? 'Visual Edit: ON' : 'Visual Edit'}
      </span>
      {enabled && (
        <span aria-hidden="true" className="size-2 rounded-full bg-accent-gold animate-pulse" />
      )}
    </button>
  );
}

/**
 * The same two destinations as full-width drawer rows.
 *
 * The header button hides below `sm` where the action cluster is tightest, so
 * without these an admin on a phone can neither enter the editor nor turn
 * visual editing on at all. Renders nothing while resolving or when the caller
 * is not an admin — a row that appears late would shove the nav links down mid-read.
 *
 * The toggle row reports its state with `aria-checked` on a `role="switch"`
 * rather than a colour alone: it is the only way the state survives a
 * screen reader, and it is the pattern the header button's `aria-pressed` and
 * this row must agree on.
 */
export function EditorialDrawerRow({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const { loading, isAdmin, target } = useEditContext(pathname ?? '/');
  const { enabled, toggle } = useVisualEditMode(pathname ?? '/');

  if (loading || !isAdmin) return null;

  return (
    <div className="rounded-xl bg-accent/15 border border-accent-gold/30 p-1.5 space-y-1">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => {
          // Closing the drawer is part of the action, not an extra one: the
          // switch flipping is not the result — the overlay on the page is, and
          // it is hidden behind the open drawer.
          toggle();
          onNavigate();
        }}
        data-testid="editorial-visual-edit-row"
        className="flex w-full items-center gap-3 px-2.5 py-2.5 rounded-lg text-accent-gold transition-colors duration-300 ease-out hover:bg-accent/25 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
      >
        <PenLine size={18} aria-hidden="true" />
        <span className="flex-1 text-left">Visual editing</span>
        <span
          aria-hidden="true"
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-300 ease-out ${
            enabled ? 'bg-accent-gold' : 'bg-white/20'
          }`}
        >
          <span
            className={`absolute top-0.5 size-4 rounded-full bg-secondary transition-all duration-300 ease-out ${
              enabled ? 'left-4.5' : 'left-0.5'
            }`}
          />
        </span>
      </button>

      {target && (
        <Link
          href={target.editUrl}
          onClick={onNavigate}
          data-testid="editorial-edit-drawer-row"
          className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-accent-gold transition-colors duration-300 ease-out hover:bg-accent/25 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
        >
          <span className="flex-1">Edit this page in admin</span>
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
