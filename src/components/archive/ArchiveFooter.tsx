import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export function ArchiveFooter() {
  return (
          <div className="mt-12 flex flex-col items-start justify-between gap-4 border-y border-border bg-surface-muted/50 p-5 sm:flex-row sm:items-center sm:p-6">
            <div>
              <p className="text-sm font-bold text-foreground dark:text-white">Looking for a specific old page?</p>
              <p className="mt-1 text-xs text-muted-foreground dark:text-ink-on-dark">
                The archive index above is complete for the preserved public pages. Raw captures remain
                private while rights and file integrity are reviewed.
              </p>
            </div>
            <Link
              href="/contact"
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 border border-primary bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark"
            >
              Ask the chapter
              <ArrowUpRight size={14} />
            </Link>
          </div>
  );
}
