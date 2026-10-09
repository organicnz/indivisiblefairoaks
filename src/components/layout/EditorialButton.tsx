'use client';

import { PenLine } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEditContext } from './useEditContext';

/**
 * Admin-only "Edit this page" entry point in the site header.
 *
 * Renders only when the current pathname resolves to a real edit URL — a
 * button with nowhere to go is a fake control, so on every other page (and
 * for every non-admin) this renders nothing at all. While resolving it holds
 * an exact-size skeleton, so an admin signing in causes no layout shift.
 * Hidden below `sm`: the action cluster is already tight at 320px, and the
 * nav drawer carries the same destination as a full-width row there.
 */
export function EditorialButton() {
  const pathname = usePathname();
  const { loading, target } = useEditContext(pathname ?? '/');

  if (loading) {
    return (
      <span aria-hidden="true" className="hidden sm:inline-block size-11 rounded-lg bg-white/10" />
    );
  }

  if (!target) return null;

  return (
    <Link
      href={target.editUrl}
      title={target.label ? `Edit "${target.label}" in admin` : 'Edit this page in admin'}
      aria-label={target.label ? `Edit ${target.label} in admin` : 'Edit this page in admin'}
      data-testid="editorial-edit-button"
      className="hidden sm:inline-flex items-center justify-center size-11 rounded-lg text-ink-on-dark hover:text-white hover:bg-white/10 transition-colors duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
    >
      <PenLine size={20} aria-hidden="true" />
    </Link>
  );
}

/**
 * The same destination as a full-width drawer row.
 *
 * The header button hides below `sm` where the action cluster is tightest, so
 * without this an admin on a phone has no route to the editor at all. Renders
 * nothing while resolving or when there is no target — a row that appears
 * late would shove the nav links down mid-read.
 */
export function EditorialDrawerRow({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const { loading, target } = useEditContext(pathname ?? '/');

  if (loading || !target) return null;

  return (
    <Link
      href={target.editUrl}
      onClick={onNavigate}
      data-testid="editorial-edit-drawer-row"
      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-accent/15 hover:bg-accent/25 border border-accent-gold/30 text-accent-gold transition-colors duration-300 ease-out text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
    >
      <PenLine size={18} aria-hidden="true" />
      <span>Edit this page in admin</span>
    </Link>
  );
}
