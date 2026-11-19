'use client';

import { FilePlus2, Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { NewsSearchField } from '@/components/ui/NewsSearchField';

type NewsletterManagerToolbarProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  loading: boolean;
  onRefresh: () => void;
  onAddNewsletter: () => void;
  newsLinkTarget: '_self' | '_blank';
  resultsId?: string;
};

export function NewsletterManagerToolbar({
  searchQuery,
  onSearchChange,
  loading,
  onRefresh,
  onAddNewsletter,
  newsLinkTarget,
  resultsId,
}: NewsletterManagerToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-muted/60 p-4">
      <div className="flex min-w-[240px] flex-1 items-center gap-2">
        <NewsSearchField
          variant="admin"
          className="flex-1"
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search bulletins by title, summary, or topic..."
          ariaLabel="Search newsletters by title, summary, or topic"
          testId="admin-newsletter-search"
          iconSize={15}
          clearLabel="Clear newsletter search"
          resultsId={resultsId}
        />

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh newsletters list"
          aria-label="Refresh newsletters list"
          className="rounded-lg border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/admin/content/new?type=post"
          target={newsLinkTarget}
          rel={newsLinkTarget === '_blank' ? 'noopener noreferrer' : undefined}
          title="Write a full news post in the block editor"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-white shadow-xs transition-colors hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <FilePlus2 size={14} aria-hidden="true" />
          <span>Add News</span>
        </Link>
        <button
          type="button"
          onClick={onAddNewsletter}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-primary bg-background px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-primary-ink transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:text-primary-on-dark"
        >
          <Plus size={14} aria-hidden="true" />
          <span>New Bulletin</span>
        </button>
      </div>
    </div>
  );
}
