'use client';

import { ArrowRight, Calendar, FileText, PenLine, Plus } from 'lucide-react';
import Link from 'next/link';
import { useEditContext } from '@/components/layout/useEditContext';
import type { PublishedPostSummary } from '@/lib/queries/content';

interface InteractivePostsListProps {
  initialPosts: PublishedPostSummary[];
}

export function InteractivePostsList({ initialPosts }: InteractivePostsListProps) {
  const { isAdmin } = useEditContext('/news');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-foreground dark:text-white tracking-tight flex items-center gap-2">
            <span className="text-primary-ink dark:text-primary-on-dark-muted font-mono text-xl">
              ✦
            </span>
            <span>Articles &amp; Dispatches</span>
          </h2>
          <p className="text-sm text-muted-foreground dark:text-ink-on-dark mt-1">
            In-depth perspectives, grassroots reports, and op-eds from our chapter organizers.
          </p>
        </div>

        {isAdmin && (
          <Link
            href="/admin/content/new?type=post"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Plus size={15} />
            <span>Write New Post</span>
          </Link>
        )}
      </div>

      {initialPosts.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-surface-card border border-border text-muted-foreground dark:text-ink-muted-on-dark">
          <FileText className="mx-auto mb-3 opacity-40" size={32} />
          <p className="text-sm">
            No published articles yet. Check back soon for deep-dive campaign reports and
            commentary!
          </p>
          {isAdmin && (
            <Link
              href="/admin/content/new?type=post"
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-gold hover:brightness-105 text-ink-strong font-bold text-xs uppercase tracking-wider shadow-sm transition-all"
            >
              <Plus size={14} />
              <span>Create the First Post</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {initialPosts.map((post) => {
            const displayDate = post.published_at
              ? new Date(post.published_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : new Date(post.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });

            return (
              <article
                key={post.id}
                className="group p-6 rounded-2xl bg-surface-card border border-border hover:border-primary/40 dark:hover:border-primary-bright/40 transition-all flex flex-col justify-between shadow-xs"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground dark:text-ink-muted-on-dark">
                      <Calendar size={13} className="text-accent-gold" />
                      {displayDate}
                    </span>

                    {isAdmin && (
                      <Link
                        href={`/admin/content/${post.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary/90 border border-accent-gold/40 text-[11px] font-bold text-accent-gold hover:text-white transition-colors"
                        title="Edit post in admin editor"
                      >
                        <PenLine size={11} />
                        <span>Edit</span>
                      </Link>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-foreground dark:text-white group-hover:text-primary-ink dark:group-hover:text-primary-on-dark transition-colors line-clamp-2">
                    <Link href={`/${post.slug}`} className="focus:outline-hidden">
                      {post.title}
                    </Link>
                  </h3>

                  {post.excerpt && (
                    <p className="text-sm text-muted-foreground dark:text-ink-on-dark line-clamp-3 leading-relaxed">
                      {post.excerpt}
                    </p>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-border dark:border-white/10 flex items-center justify-between">
                  <Link
                    href={`/${post.slug}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-ink dark:text-primary-on-dark group-hover:gap-2.5 transition-all focus:outline-hidden"
                  >
                    <span>Read Article</span>
                    <ArrowRight size={14} />
                  </Link>
                  <span className="text-[11px] font-mono text-muted-foreground dark:text-ink-muted-on-dark uppercase">
                    Dispatch
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
