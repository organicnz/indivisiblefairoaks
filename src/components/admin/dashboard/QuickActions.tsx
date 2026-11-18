import { Calendar, FilePlus2, FileText, Link2, Newspaper } from 'lucide-react';
import Link from 'next/link';

export function QuickActions() {
  return (
      <div className="bg-surface-card border border-border rounded-3xl p-6 shadow-xs mb-8">
        <div className="mb-4">
          <h2 className="font-display text-sm font-semibold tracking-[-0.01em] text-foreground">
            Civic publishing &amp; content
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Publish new dispatches, update chapter events, issue bulletins, and maintain coalition
            links.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Link
            href="/admin/content/new?type=post"
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-primary dark:bg-primary-bright text-white hover:bg-primary-dark dark:hover:bg-primary-light transition-[background-color,border-color,transform] duration-150 text-center shadow-xs font-bold text-xs uppercase tracking-wider group focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <FilePlus2 size={20} className="group-hover:scale-110 transition-transform" />
            <span>Add News</span>
          </Link>
          <Link
            href="/admin/events"
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-surface-muted border border-border text-foreground hover:border-primary/40 hover:bg-primary/5 transition-[background-color,border-color,transform] duration-150 text-center font-bold text-xs uppercase tracking-wider group focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <Calendar
              size={20}
              className="text-primary-ink dark:text-primary-on-dark group-hover:scale-110 transition-transform"
            />
            <span>Events &amp; Rallies</span>
          </Link>
          <Link
            href="/admin/news"
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-surface-muted border border-border text-foreground hover:border-primary/40 hover:bg-primary/5 transition-[background-color,border-color,transform] duration-150 text-center font-bold text-xs uppercase tracking-wider group focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <Newspaper
              size={20}
              className="text-accent-gold group-hover:scale-110 transition-transform"
            />
            <span>News &amp; Bulletins</span>
          </Link>
          <Link
            href="/admin/links"
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-surface-muted border border-border text-foreground hover:border-primary/40 hover:bg-primary/5 transition-[background-color,border-color,transform] duration-150 text-center font-bold text-xs uppercase tracking-wider group focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <Link2
              size={20}
              className="text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform"
            />
            <span>Action Links</span>
          </Link>
          <Link
            href="/admin/content"
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-surface-muted border border-border text-foreground hover:border-primary/40 hover:bg-primary/5 transition-[background-color,border-color,transform] duration-150 text-center font-bold text-xs uppercase tracking-wider group focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <FileText
              size={20}
              className="text-muted-foreground group-hover:scale-110 transition-transform"
            />
            <span>All Pages &amp; Posts</span>
          </Link>
        </div>
      </div>
  );
}
