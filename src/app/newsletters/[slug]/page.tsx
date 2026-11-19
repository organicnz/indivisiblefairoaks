import { Archive, ArrowLeft, FileText, Newspaper } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
  SECTION_TITLE,
} from '@/components/layout/PageMasthead';
import { NewsletterTopicPills } from '@/components/newsletters/NewsletterTopicPills';
import { ROBOTS } from '@/config/site';
import { metaDescription, pageMetadata } from '@/lib/metadata';
import { getNewsletterBySlug } from '@/lib/queries/civic';

type NewsletterDetailPageProps = {
  params: Promise<{ slug: string }>;
};

// Deliberate Cache Components opt-out (Block): the slug and issue body are
// request-time. Without this, accessing `params` during prerender aborts the
// route, hides the global header, and serves a page with no h1.
export const instant = false;

export async function generateMetadata({ params }: NewsletterDetailPageProps): Promise<Metadata> {
  const slug = (await params).slug;
  const newsletter = await getNewsletterBySlug(slug);

  if (!newsletter) {
    return { title: 'Bulletin Not Found', robots: ROBOTS.noindex };
  }

  return pageMetadata({
    title: newsletter.title,
    description: metaDescription(newsletter.description || newsletter.body || ''),
    path: `/newsletters/${newsletter.slug}`,
    type: 'article',
    publishedTime: newsletter.published_at ?? undefined,
    authors: ['Indivisible Fair Oaks-Carmichael'],
  });
}

/**
 * The on-site issue reader. `body` is plain text, so paragraphs are split here
 * instead of handing authored HTML to a renderer that trusts it.
 */
function IssueBody({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <div className="mt-5 space-y-5 text-base leading-8 text-foreground/90">
      {paragraphs.map((paragraph, index) => (
        <p key={`${paragraph.slice(0, 24)}-${index}`} className="whitespace-pre-line break-words">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

export default async function NewsletterDetailPage({ params }: NewsletterDetailPageProps) {
  const slug = (await params).slug;
  const newsletter = await getNewsletterBySlug(slug);

  if (!newsletter) notFound();

  const body = newsletter.body?.trim() || '';
  const pdfUrl = newsletter.pdf_url?.trim() || null;
  const archiveUrl = newsletter.archive_url?.trim() || null;
  const hasFullIssue = Boolean(body || pdfUrl || archiveUrl);

  return (
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance)">
      <PageMasthead
        eyebrow="Chapter bulletin"
        icon={Newspaper}
        title={<h1 className={MASTHEAD_TITLE}>{newsletter.title}</h1>}
        intro={
          newsletter.description ? (
            <p className={MASTHEAD_INTRO}>{newsletter.description}</p>
          ) : undefined
        }
        meta={
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="civic-section-index">{newsletter.date_label}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {hasFullIssue ? 'Full issue' : 'Issue summary'}
              </span>
            </div>
            <NewsletterTopicPills topics={newsletter.topics} />
          </div>
        }
      />

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <Link
          href="/newsletters"
          className="inline-flex min-h-10 items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-on-dark"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          All bulletins
        </Link>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <article className="min-w-0">
            <div className="civic-panel p-6 sm:p-8">
              <p className="civic-section-index">{body ? 'The full issue' : 'Issue summary'}</p>
              <h2 className={`mt-2 ${SECTION_TITLE}`}>
                {body ? 'From the chapter' : 'What this issue covers'}
              </h2>

              {body ? (
                <IssueBody text={body} />
              ) : (
                <p className="mt-5 break-words text-base leading-8 text-muted-foreground">
                  {newsletter.description}
                </p>
              )}

              {!hasFullIssue ? (
                <p className="mt-6 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                  This bulletin is archived as a summary. No full issue text or file is attached to
                  this record yet.
                </p>
              ) : null}
            </div>

            <div className="mt-8 border-t border-border pt-6">
              <Link
                href="/newsletters"
                className="inline-flex min-h-10 items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:text-primary-on-dark"
              >
                <ArrowLeft size={14} aria-hidden="true" />
                Back to the bulletin archive
              </Link>
            </div>
          </article>

          <aside aria-label="Issue files" className="lg:pt-1">
            <div className="civic-panel p-5">
              <p className="civic-section-index">Issue files</p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em]">
                Take it with you
              </h2>

              {pdfUrl || archiveUrl ? (
                <div className="mt-4 space-y-2">
                  {pdfUrl ? (
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 items-center justify-between gap-3 border border-border bg-surface-muted/40 px-3 py-2 text-xs font-bold text-foreground transition-colors hover:border-primary/40 hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:text-primary-on-dark"
                    >
                      <span className="inline-flex items-center gap-2">
                        <FileText size={14} aria-hidden="true" />
                        Download PDF
                      </span>
                      <span aria-hidden="true">&rarr;</span>
                    </a>
                  ) : null}
                  {archiveUrl ? (
                    <a
                      href={archiveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 items-center justify-between gap-3 border border-border bg-surface-muted/40 px-3 py-2 text-xs font-bold text-foreground transition-colors hover:border-primary/40 hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:text-primary-on-dark"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Archive size={14} aria-hidden="true" />
                        Open archive
                      </span>
                      <span aria-hidden="true">&rarr;</span>
                    </a>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  No separate PDF or external archive is attached to this bulletin.
                </p>
              )}

              <p className="mt-5 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
                Published by Indivisible Fair Oaks-Carmichael. This page is the durable reader
                destination for the issue.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
