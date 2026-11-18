import { Archive, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import type { ComponentProps } from 'react';
import { LegacyDocumentArchive } from '@/components/archive/LegacyDocumentArchive';

type EventsArchiveSectionProps = {
  legacyEventDocuments: ComponentProps<typeof LegacyDocumentArchive>['documents'];
};

export function EventsArchiveSection({ legacyEventDocuments }: EventsArchiveSectionProps) {
  return (
    <>
      <div className="flex flex-col items-start justify-between gap-5 border-y border-border bg-surface-card p-6 sm:p-8 md:flex-row md:items-center">
          <div>
            <div className="civic-stamp">
              <Archive size={12} />
              Past events
            </div>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-[-0.03em]">
              Looking for an event that has already happened?
            </h2>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
              Flyers, event pages, and the complete public record from the chapter’s earlier Google
              Sites are preserved in the archive.
            </p>
          </div>
          <Link
            href="/archive"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 border border-primary bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark"
          >
            Browse the archive
            <ArrowUpRight size={14} />
          </Link>
        </div>

        {legacyEventDocuments.length > 0 ? (
          <div className="pt-2 border-t border-border">
            <LegacyDocumentArchive
              documents={legacyEventDocuments}
              title="Event flyers & documents"
              description="Event material preserved from the old site. Files cleared for republication are hosted here; other items point to their original source."
              limit={6}
            />
          </div>
        ) : null}
    </>
  );
}
