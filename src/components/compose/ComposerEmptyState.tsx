import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

export function ComposerEmptyState({ contentId }: { contentId: number }) {
  return (
    <div className="mt-8 border border-dashed border-border bg-surface-muted/40 px-6 py-8 text-center">
      <p className="text-xl font-semibold text-foreground">This row has no copy yet.</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Add the first block in the visual editor, or build the page in the content editor.
      </p>
      <Link
        href={`/admin/content/${contentId}`}
        className="mt-4 inline-flex items-center gap-1.5 border border-border bg-surface-card px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary"
      >
        Open content editor
        <ExternalLink size={12} aria-hidden="true" />
      </Link>
    </div>
  );
}
