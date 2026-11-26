import { Archive, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { CopyRegion } from '@/components/cms/CopyRegion';

export function VoterArchiveSection() {
  return (
    <section
      id="archives"
      aria-labelledby="voter-archives-heading"
      className="scroll-mt-28 border-y border-border bg-surface-card p-6 sm:p-8"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <p className="civic-section-index inline-flex items-center gap-1.5">
            <Archive className="size-3.5" aria-hidden="true" />
            2026 archive
          </p>
          <CopyRegion id="voter-archive">
            <div>
              <h2
                id="voter-archives-heading"
                className="mt-2 font-display text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl"
              >
                Voter Information Archives
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
                The 2026 voter guides and nonpartisan documents from the chapter’s previous site are
                preserved in the Chapter Archive. They are historical reference, not a live election
                guide or a current recommendation.
              </p>
            </div>
          </CopyRegion>
        </div>

        <Link
          href="/archive#voter-guides-2026"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border border-primary bg-primary px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Open the 2026 voter archive
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
