'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { countPages } from '@/lib/crm-filters';

interface Props {
  page: number;
  totalCount: number;
  pageSize: number;
  /** Path without query string, e.g. `/admin/crm` */
  basePath: string;
  /** Query params to preserve (page is managed separately). */
  params?: URLSearchParams;
}

/**
 * How many numbered links to show around the current page.
 *
 * `1 … 4 5 [6] 7 8 … 30`. Prev/Next alone was the whole navigation on a
 * directory that could hold thousands of constituents, so reaching page 30 meant
 * clicking Next twenty-nine times — which is how a chapter ends up only ever
 * working with the first fifty people in the list.
 */
const WINDOW = 2;

/**
 * The page numbers to render, with `null` standing for an ellipsis.
 *
 * `null` rather than a string so a real page can never be confused with the
 * ellipsis, and so the key is the number itself.
 */
export function pageWindow(page: number, total: number): (number | null)[] {
  if (total <= 1) return [1];

  const wanted = new Set<number>([1, total]);
  for (let p = page - WINDOW; p <= page + WINDOW; p += 1) {
    if (p >= 1 && p <= total) wanted.add(p);
  }
  const sorted = [...wanted].sort((a, b) => a - b);

  const out: (number | null)[] = [];
  let previous: number | null = null;
  for (const p of sorted) {
    if (previous !== null) {
      // A gap of exactly one missing page is not worth an ellipsis: it is a single
      // page, and hiding it behind "…" makes the control longer while saying
      // less. Two or more missing pages becomes one ellipsis.
      if (p - previous > 2) out.push(null);
    }
    out.push(p);
    previous = p;
  }
  return out;
}

/**
 * Pagination controls.
 *
 * No count here. The "Showing X–Y of Z · page N of M" line belongs to the surface
 * that owns the result set — it is what the user is reading — and it has to
 * render even when there are no page controls, which is the case that made the
 * two copies disagree. `CRMContactList` renders it; this renders the way to move.
 */
export function CRMPager({ page, totalCount, pageSize, basePath, params }: Props) {
  const total = countPages(totalCount, pageSize);
  if (total <= 1) return null;

  const hrefFor = (p: number) => {
    const next = new URLSearchParams(params);
    if (p <= 1) next.delete('page');
    else next.set('page', String(p));
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const navLink =
    'inline-flex items-center gap-1 px-3 py-2 bg-surface-muted hover:bg-surface-muted text-slate-700 rounded-xl text-xs font-bold transition-colors';
  const navDisabled =
    'inline-flex items-center gap-1 px-3 py-2 text-muted-foreground text-xs font-bold cursor-not-allowed';

  return (
    <nav aria-label="Pagination" className="flex items-center gap-1.5">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={navLink} rel="prev" aria-label="Previous page">
          <ChevronLeft size={14} aria-hidden="true" /> Previous
        </Link>
      ) : (
        <span className={navDisabled} aria-disabled="true">
          <ChevronLeft size={14} aria-hidden="true" /> Previous
        </span>
      )}

      <ol className="flex items-center gap-1">
        {pageWindow(page, total).map((p) =>
          p === null ? (
            <li
              // An ellipsis has no identity of its own, and its position in the
              // window is stable for a given `page` — so the key is derived from
              // the page it follows, not from the array index. Two ellipses in one
              // window is impossible anyway: the window collapses a single
              // missing page rather than emitting a gap for it.
              key={`gap-before-${total}-${page}`}
              aria-hidden="true"
              className="px-1 text-xs text-muted-foreground"
            >
              …
            </li>
          ) : (
            <li key={p}>
              {p === page ? (
                <span
                  aria-current="page"
                  className="inline-flex items-center justify-center min-w-8 px-2 py-2 rounded-xl bg-primary text-white text-xs font-black"
                >
                  {p}
                </span>
              ) : (
                <Link
                  href={hrefFor(p)}
                  aria-label={`Page ${p}`}
                  className="inline-flex items-center justify-center min-w-8 px-2 py-2 bg-surface-muted hover:bg-surface-muted text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  {p}
                </Link>
              )}
            </li>
          )
        )}
      </ol>

      {page < total ? (
        <Link href={hrefFor(page + 1)} className={navLink} rel="next" aria-label="Next page">
          Next <ChevronRight size={14} aria-hidden="true" />
        </Link>
      ) : (
        <span className={navDisabled} aria-disabled="true">
          Next <ChevronRight size={14} aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}
