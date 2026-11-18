import { BookOpen } from 'lucide-react';
import Link from 'next/link';

export function NewsPublishingGuide() {
  return (
      <section
        aria-labelledby="news-publishing-guide"
        className="rounded-sm border border-border bg-surface-card p-5 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary-ink dark:text-primary-on-dark">
            <BookOpen size={18} aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              Chapter editor guide
            </p>
            <h2
              id="news-publishing-guide"
              className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em]"
            >
              How to publish
            </h2>
            <p className="mt-1 max-w-2xl text-xs font-semibold leading-relaxed text-muted-foreground">
              Use a news post for a full article and a bulletin for a short, email-style update. If
              these controls are not visible, your account has not been granted editor access yet.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <article className="flex flex-col rounded-xl border border-border bg-background p-4">
            <h3 className="font-display text-lg font-semibold tracking-[-0.02em]">
              Add a news post
            </h3>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">
              Best for reports, event recaps, statements, and longer articles. Posts support the
              block editor, images, an excerpt, SEO fields, drafts, preview, and revision history.
            </p>
            <Link
              href="/admin/content/new?type=post"
              className="mt-4 inline-flex min-h-10 items-center justify-center rounded-sm bg-primary px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Add News
            </Link>
          </article>

          <article className="flex flex-col rounded-xl border border-border bg-background p-4">
            <h3 className="font-display text-lg font-semibold tracking-[-0.02em]">
              Publish a bulletin
            </h3>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">
              Best for a monthly bulletin, a short news blast, or a legislative round-up. The
              editor previews the public card and schedules publication in Pacific chapter time.
            </p>
            <Link
              href="#bulletin-manager"
              className="mt-4 inline-flex min-h-10 items-center justify-center rounded-sm border border-primary bg-background px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-primary-ink transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:text-primary-on-dark"
            >
              Go to the bulletin manager
            </Link>
          </article>
        </div>

        <details className="mt-4 rounded-xl border border-border bg-background p-4">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-foreground">
            Step-by-step checklist
          </summary>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-muted-foreground">
            <li>Choose a news post for a full article or a bulletin for a short update.</li>
            <li>
              Add a clear title and a one-sentence excerpt or summary. Put names, dates, and
              locations in the body, not only in an image.
            </li>
            <li>
              Use Preview to check the layout before publishing. On a bulletin, review the live card
              preview, topics, and Pacific publication time.
            </li>
            <li>
              Publish, then open{' '}
              <Link
                href="/news"
                className="font-bold text-primary-ink underline underline-offset-2 dark:text-primary-on-dark"
              >
                /news
              </Link>{' '}
              for a post or{' '}
              <Link
                href="/newsletters"
                className="font-bold text-primary-ink underline underline-offset-2 dark:text-primary-on-dark"
              >
                /newsletters
              </Link>{' '}
              for a bulletin, and confirm the item appears where readers will see it.
            </li>
            <li>
              Fix typos with Edit. News posts keep revision history and can be restored; bulletins
              save in place and show as published or scheduled.
            </li>
          </ol>
        </details>
      </section>
  );
}
