import { BookOpen, Newspaper } from 'lucide-react';
import Link from 'next/link';
import { CivicNewsletterManager } from '@/components/admin/civic/CivicNewsletterManager';
import { requireAdminPage } from '@/lib/admin-auth';

export const instant = false;

export async function generateMetadata() {
  return {
    title: 'Newsletters & Bulletins — Admin · Indivisible Fair Oaks',
    description:
      'Publish, edit, and organize past chapter bulletins, newsletters, and action alerts.',
    robots: { index: false, follow: false },
  };
}

export default async function AdminNewsPage() {
  await requireAdminPage();

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-xs">
            <Newspaper size={20} />
          </div>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
            Admin Panel · Chapter Bulletins
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground uppercase">
          Newsletters &amp; Bulletins
        </h1>
        <div className="h-1.5 w-24 bg-primary mt-3" />
        <p className="mt-3 text-xs font-bold text-muted-foreground max-w-2xl">
          Publish monthly chapter bulletins, legislative round-ups, and resistance updates. To
          publish full long-form articles, use Pages &amp; Posts with type &ldquo;Post&rdquo;.
        </p>
      </div>

      <section
        aria-labelledby="news-publishing-guide"
        className="rounded-2xl border border-border bg-surface-card p-5 shadow-xs sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-ink dark:text-primary-on-dark">
            <BookOpen size={18} aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              Chapter editor guide
            </p>
            <h2 id="news-publishing-guide" className="mt-1 text-xl font-black tracking-tight">
              How to publish news
            </h2>
            <p className="mt-1 max-w-2xl text-xs font-semibold leading-relaxed text-muted-foreground">
              Use this page whenever the chapter has something to share. Choose a news post for a
              full article, or a bulletin for a short email-style update. If these controls are not
              visible, your account has not been granted editor access yet.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <article className="flex flex-col rounded-xl border border-border bg-background p-4">
            <h3 className="text-sm font-black uppercase tracking-wider">Write a news post</h3>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">
              Best for reports, event recaps, statements, and longer articles. Posts support the
              block editor, images, an excerpt, SEO fields, drafts, and preview.
            </p>
            <Link
              href="/admin/content/new?type=post"
              className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-3 py-2 text-[11px] font-black uppercase tracking-wider text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Write a new post
            </Link>
          </article>

          <article className="flex flex-col rounded-xl border border-border bg-background p-4">
            <h3 className="text-sm font-black uppercase tracking-wider">Publish a bulletin</h3>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">
              Best for a monthly bulletin, a short news blast, or a legislative round-up. Bulletins
              appear in the chapter&rsquo;s newsletter archive with a topic and date label.
            </p>
            <Link
              href="#bulletin-manager"
              className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border border-primary bg-background px-3 py-2 text-[11px] font-black uppercase tracking-wider text-primary-ink transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:text-primary-on-dark"
            >
              Go to the bulletin manager
            </Link>
          </article>
        </div>

        <details className="mt-4 rounded-xl border border-border bg-background p-4">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-foreground">
            Step-by-step checklist
          </summary>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-muted-foreground">
            <li>Choose a news post for a full article or a bulletin for a short update.</li>
            <li>
              Add a clear title and a one-sentence excerpt or description. Put names, dates, and
              locations in the body, not only in an image.
            </li>
            <li>Use Preview to check the layout before publishing. On a bulletin, review the topic tags and date label.</li>
            <li>Publish, then open <Link href="/news" className="font-bold text-primary-ink underline underline-offset-2 dark:text-primary-on-dark">/news</Link> for a post or <Link href="/newsletters" className="font-bold text-primary-ink underline underline-offset-2 dark:text-primary-on-dark">/newsletters</Link> for a bulletin, and confirm the item appears where readers will see it.</li>
            <li>Fix typos with Edit; changes are versioned in the editor and can be restored.</li>
          </ol>
        </details>
      </section>

      <div id="bulletin-manager" className="scroll-mt-28">
        <CivicNewsletterManager />
      </div>
    </div>
  );
}
