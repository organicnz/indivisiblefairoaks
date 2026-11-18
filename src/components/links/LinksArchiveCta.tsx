import { Archive, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { CopyRegion } from '@/components/cms/CopyRegion';

export function LinksArchiveCta() {
  return (
        <div className="flex flex-col items-start justify-between gap-5 border-y border-border bg-surface-card p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center border border-border bg-background text-accent">
              <Archive size={20} />
            </span>
            <CopyRegion id="links-archive">
              <div>
                <h2 className="font-display text-2xl font-semibold tracking-[-0.03em]">
                  Looking for an older link?
                </h2>
                <p className="mt-1 max-w-xl text-xs sm:text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
                  The complete link list from the chapter’s Google Sites — including organization
                  sites that are no longer active — is preserved in the archive with its original
                  page context.
                </p>
              </div>
            </CopyRegion>
          </div>
          <Link
            href="/archive"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 border border-primary bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark"
          >
            Open archive
            <ArrowUpRight size={14} />
          </Link>
        </div>
  );
}
