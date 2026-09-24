'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface Props {
  page: number;
  totalCount: number;
  pageSize: number;
  /** Path without query string, e.g. `/admin/crm` */
  basePath: string;
  /** Query params to preserve (page is managed separately). */
  params?: URLSearchParams;
}

export function CRMPager({ page, totalCount, pageSize, basePath, params }: Props) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  const hrefFor = (p: number) => {
    const next = new URLSearchParams(params);
    if (p <= 1) next.delete('page');
    else next.set('page', String(p));
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100"
    >
      <p className="text-xs font-bold text-slate-500">
        Showing{' '}
        <span className="text-secondary font-black">
          {from}–{to}
        </span>{' '}
        of <span className="text-secondary font-black">{totalCount}</span>
        <span className="text-slate-400">
          {' '}
          · page {page} of {totalPages}
        </span>
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={hrefFor(page - 1)}
            className="inline-flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            rel="prev"
          >
            <ChevronLeft size={14} /> Previous
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 px-3 py-2 text-slate-300 text-xs font-bold cursor-not-allowed">
            <ChevronLeft size={14} /> Previous
          </span>
        )}
        {page < totalPages ? (
          <Link
            href={hrefFor(page + 1)}
            className="inline-flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            rel="next"
          >
            Next <ChevronRight size={14} />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 px-3 py-2 text-slate-300 text-xs font-bold cursor-not-allowed">
            Next <ChevronRight size={14} />
          </span>
        )}
      </div>
    </nav>
  );
}
