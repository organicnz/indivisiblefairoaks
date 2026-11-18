import { ArrowRight, Eye, FilePlus2, Newspaper, Pencil } from 'lucide-react';
import Link from 'next/link';
import type { ContentListRow } from '@/lib/actions/content';
import { newsPresentation } from './news-presentation';

type RecentNewsSectionProps = {
  rows: ContentListRow[];
  now: number;
};

export function RecentNewsSection({ rows, now }: RecentNewsSectionProps) {
  return (
      <section
        aria-labelledby="recent-news-heading"
        className="rounded-sm border border-border bg-surface-card shadow-xs"
      >
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              Newsroom
            </p>
            <h2
              id="recent-news-heading"
              className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em]"
            >
              Recent news
            </h2>
            <p className="mt-1 max-w-2xl text-xs font-semibold leading-relaxed text-muted-foreground">
              The latest posts, newest edits first. Open one to edit the full article, or preview it
              exactly as readers see it.
            </p>
          </div>
          <Link
            href="/admin/content?type=post"
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-on-dark"
          >
            Manage all news
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-center">
            <Newspaper size={28} className="mx-auto text-muted-foreground/60" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold text-foreground">No news posts yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Add the chapter&rsquo;s first article. It starts as a draft, so nothing goes live until
              you publish it.
            </p>
            <Link
              href="/admin/content/new?type=post"
              className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <FilePlus2 size={14} aria-hidden="true" />
              Add News
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              const presentation = newsPresentation(row, now);
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-4 p-5 transition-colors hover:bg-surface-muted/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${presentation.badge}`}
                      >
                        {presentation.label}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <time dateTime={presentation.dateTime ?? undefined}>
                          {presentation.dateText}
                        </time>
                      </span>
                    </div>
                    <h3 className="mt-1.5 truncate font-display text-lg font-semibold tracking-[-0.02em]">
                      <Link
                        href={`/admin/content/${row.id}`}
                        className="underline-offset-2 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:text-primary-on-dark"
                      >
                        {row.title}
                      </Link>
                    </h3>
                    <p className="mt-1 line-clamp-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                      {row.excerpt || 'No excerpt yet — open the post to add one.'}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                    <Link
                      href={`/admin/content/${row.id}`}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Pencil size={12} aria-hidden="true" />
                      Edit
                    </Link>
                    {presentation.publicHref ? (
                      <Link
                        href={presentation.publicHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <Eye size={12} aria-hidden="true" />
                        View
                        <span className="sr-only"> (opens in a new tab)</span>
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
  );
}
