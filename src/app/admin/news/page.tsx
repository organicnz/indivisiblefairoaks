import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  Eye,
  FilePlus2,
  Newspaper,
  Pencil,
} from 'lucide-react';
import Link from 'next/link';
import { CivicNewsletterManager } from '@/components/admin/civic/CivicNewsletterManager';
import { getCivicNewslettersAdmin } from '@/lib/actions/civic';
import { type ContentListRow, getContentList } from '@/lib/actions/content';
import { requireAdminPage } from '@/lib/admin-auth';
import { contentPublicHref } from '@/lib/content';

export const instant = false;

const ADMIN_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'America/Los_Angeles',
});

function adminDate(value: string | null | undefined): string {
  if (!value) return 'No date';
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 'No date' : ADMIN_DATE.format(new Date(parsed));
}

function newsPresentation(row: ContentListRow, now: number) {
  if (row.status !== 'publish') {
    return {
      label: 'Draft',
      badge:
        'border-border bg-surface-muted text-foreground',
      publicHref: null,
      dateText: `Updated ${adminDate(row.updated_at)}`,
      dateTime: row.updated_at,
    };
  }

  const published = row.published_at ? Date.parse(row.published_at) : null;
  if (published !== null && Number.isFinite(published) && published > now) {
    return {
      label: 'Scheduled',
      badge:
        'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200',
      publicHref: null,
      dateText: `Scheduled for ${adminDate(row.published_at)}`,
      dateTime: row.published_at,
    };
  }

  return {
    label: 'Published',
    badge:
      'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-200',
    publicHref: contentPublicHref(row),
    dateText: `Published ${adminDate(row.published_at ?? row.updated_at)}`,
    dateTime: row.published_at ?? row.updated_at,
  };
}

export async function generateMetadata() {
  return {
    title: 'News & Bulletins — Admin · Indivisible Fair Oaks',
    description:
      'Write chapter news in the block editor, manage the bulletin archive, and edit published stories.',
    robots: { index: false, follow: false },
  };
}

export default async function AdminNewsPage() {
  await requireAdminPage();

  const [recentNews, newsletterResult] = await Promise.all([
    getContentList({ type: 'post', pageSize: 6 }),
    getCivicNewslettersAdmin(),
  ]);
  const initialNewsletters = newsletterResult.success ? (newsletterResult.data ?? []) : undefined;
  const now = Date.now();

  return (
    <div className="space-y-6">
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

        {recentNews.rows.length === 0 ? (
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
            {recentNews.rows.map((row) => {
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

      <div id="bulletin-manager" className="scroll-mt-28">
        <CivicNewsletterManager initialNewsletters={initialNewsletters} />
      </div>

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
    </div>
  );
}
