import { ArrowLeft, FileQuestion } from 'lucide-react';
import Link from 'next/link';

/**
 * A composer row that no longer exists — or that this account cannot read —
 * gets its own answer. Falling through to the app-wide 404 would tell an
 * operator the URL is wrong without mentioning the list that can find the row.
 */
export default function ComposerWorkspaceNotFound() {
  return (
    <div className="min-h-screen bg-background pb-[calc(6rem+env(safe-area-inset-bottom))] pt-(--header-clearance) text-foreground">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="border-b-2 border-foreground/15 py-10">
          <p className="civic-kicker">Composer workspace</p>
          <div className="mt-4 flex items-start gap-3">
            <FileQuestion
              size={28}
              className="mt-1 shrink-0 text-accent-gold"
              aria-hidden="true"
            />
            <div>
              <h1 className="text-4xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-5xl">
                That row is not available.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
                It may have been deleted, or this account may no longer have access to it. The
                content list is the reliable way back to the row.
              </p>
            </div>
          </div>

          <Link
            href="/admin/content"
            className="mt-6 inline-flex items-center gap-1.5 border border-border bg-surface-card px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            Back to content
          </Link>
        </div>
      </div>
    </div>
  );
}
