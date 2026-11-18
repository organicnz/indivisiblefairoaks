import { CalendarClock, FilePlus2, Newspaper } from 'lucide-react';
import Link from 'next/link';

export function AdminNewsHeader() {
  return (
      <div className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-white shadow-xs">
              <Newspaper size={20} aria-hidden="true" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
              Admin Panel · Chapter News
            </span>
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
            News &amp; bulletins
          </h1>
          <div className="mt-3 h-1.5 w-24 bg-primary" />
          <p className="mt-3 max-w-2xl text-xs font-bold text-muted-foreground">
            Write full articles in the block editor, publish short bulletins, and edit what is
            already live without hunting through the page directory.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="#bulletin-manager"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-sm border border-primary bg-background px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-primary-ink transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:text-primary-on-dark"
          >
            <CalendarClock size={15} aria-hidden="true" />
            <span>Manage bulletins</span>
          </Link>
          <Link
            href="/admin/content/new?type=post"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-sm bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <FilePlus2 size={15} aria-hidden="true" />
            <span>Add News</span>
          </Link>
        </div>
      </div>
  );
}
