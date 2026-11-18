import { ArrowLeft, ExternalLink, Paintbrush } from 'lucide-react';
import Link from 'next/link';

type ComposerWorkspaceHeaderProps = {
  id: number;
  title: string;
  slug: string;
  status: string | null;
  publicHref: string | null;
  hasConflict: boolean;
};

export function ComposerWorkspaceHeader({
  id,
  title,
  slug,
  status,
  publicHref,
  hasConflict,
}: ComposerWorkspaceHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5 border-b-2 border-foreground/15 py-8">
      <div className="min-w-0">
        <p className="civic-kicker">
          <Paintbrush size={12} aria-hidden="true" />
          Composer workspace
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[0.95] tracking-[-0.045em] text-foreground sm:text-5xl">
          {title}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          <span className="font-mono font-medium normal-case tracking-normal">Row #{id}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono font-medium normal-case tracking-normal">/{slug}</span>
          <span aria-hidden="true">·</span>
          <span className={status === 'publish' ? 'text-primary-ink' : 'text-accent-gold'}>
            {status === 'publish' ? 'Published' : 'Draft'}
          </span>
          {!publicHref && !hasConflict ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-accent-gold">No public route</span>
            </>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/admin/content/${id}`}
          className="inline-flex items-center gap-1.5 border border-border bg-surface-card px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to editor
        </Link>
        {publicHref ? (
          <Link
            href={publicHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 bg-primary px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            View page
            <ExternalLink size={12} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
