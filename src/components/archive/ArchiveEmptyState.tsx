import { Archive } from 'lucide-react';
import { CopyRegion } from '@/components/cms/CopyRegion';

export function ArchiveEmptyState() {
  return (
          <div className="border-y border-border bg-surface-card p-8 text-center sm:p-12">
            <Archive className="mx-auto text-accent-gold" size={32} />
            <CopyRegion id="archive-empty">
              <div>
                <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.03em]">
                  The archive is being prepared
                </h2>
                <p className="mt-2 max-w-xl mx-auto text-sm text-muted-foreground dark:text-ink-on-dark leading-relaxed">
                  The public index will appear after the legacy migration is applied and the
                  read-only capture has been reviewed.
                </p>
              </div>
            </CopyRegion>
            <p className="mt-2 max-w-xl mx-auto text-sm text-muted-foreground dark:text-ink-on-dark leading-relaxed">
              The original pages are still available on{' '}
              <a
                href="https://sites.google.com/indivisiblefairoaks.org/indivisiblefairoaks/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary-ink dark:text-primary-on-dark hover:underline"
              >
                the old Google Sites
              </a>
              .
            </p>
          </div>
  );
}
