import { ShieldCheck } from 'lucide-react';
import type { LegacyPageRow } from '@/lib/queries/legacy';
import { pageAnchor } from './archive-format';

type ArchiveNavProps = {
  pages: LegacyPageRow[];
};

export function ArchiveNav({ pages }: ArchiveNavProps) {
  return (
    <nav
      aria-label="Archive pages"
      className="border-y border-border bg-surface-card p-4 lg:sticky lg:top-28"
    >
      <p className="civic-meta px-2">On this page</p>
      <ol className="mt-3 space-y-1">
        <li>
          <a
            href="#voter-guides-2026"
            className="flex items-start gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-foreground/80 dark:text-ink-on-dark hover:bg-surface-muted hover:text-primary-ink dark:hover:text-accent-gold transition-colors"
          >
            <span className="font-mono text-[10px] text-primary-ink dark:text-accent-gold pt-0.5">
              2026
            </span>
            <span>Voter Guides &amp; Recommendations</span>
          </a>
        </li>
        {pages.map((page, index) => (
          <li key={page.id}>
            <a
              href={`#${pageAnchor(page.source_path)}`}
              className="flex items-start gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-foreground/80 dark:text-ink-on-dark hover:bg-surface-muted hover:text-primary-ink dark:hover:text-accent-gold transition-colors"
            >
              <span className="font-mono text-[10px] text-muted-foreground pt-0.5">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span>{page.title}</span>
            </a>
          </li>
        ))}
      </ol>
      <div className="mt-4 border-t border-border pt-4 px-2 text-[11px] leading-relaxed text-muted-foreground dark:text-ink-muted-on-dark">
        <ShieldCheck size={14} className="inline mr-1 text-accent-gold" />
        Approved public rows only. Private captures are not linked from this page.
      </div>
    </nav>
  );
}
