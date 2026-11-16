'use client';

import { ArrowRight, BookOpen, Calendar, FileText, Mail, PenLine, Plus } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEditContext } from '@/components/layout/useEditContext';
import type { PublishedPostSummary } from '@/lib/queries/content';

interface InteractivePostsListProps {
  initialPosts: PublishedPostSummary[];
}

const PACIFIC_TIME_ZONE = 'America/Los_Angeles';

function postDate(post: PublishedPostSummary): { label: string; dateTime: string } | null {
  const value = post.published_at ?? post.created_at;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    label: date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: PACIFIC_TIME_ZONE,
    }),
    dateTime: date.toISOString(),
  };
}

function PostDate({ post }: { post: PublishedPostSummary }) {
  const date = postDate(post);
  if (!date) return null;
  return (
    <time
      dateTime={date.dateTime}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground dark:text-ink-muted-on-dark"
    >
      <Calendar size={13} className="text-accent-gold" aria-hidden="true" />
      {date.label}
    </time>
  );
}

function AdminEditLink({ postId }: { postId: number }) {
  return (
    <Link
      href={`/admin/content/${postId}`}
      className="inline-flex min-h-8 items-center gap-1 border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      title="Edit post in admin editor"
    >
      <PenLine size={11} aria-hidden="true" />
      <span>Edit</span>
    </Link>
  );
}

function LeadStory({ post, isAdmin }: { post: PublishedPostSummary; isAdmin: boolean }) {
  return (
    <article className="civic-panel group overflow-hidden">
      <div className="grid lg:grid-cols-12">
        {post.featured_image ? (
          <div className="relative aspect-[16/10] overflow-hidden border-b border-border lg:col-span-5 lg:aspect-auto lg:min-h-[24rem] lg:border-b-0 lg:border-r">
            <Image
              src={post.featured_image}
              alt=""
              fill
              sizes="(min-width: 1024px) 42vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </div>
        ) : null}

        <div
          className={`flex flex-col justify-between p-6 sm:p-8 ${
            post.featured_image ? 'lg:col-span-7' : 'lg:col-span-12'
          }`}
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex border border-primary bg-primary px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
                Lead story
              </span>
              <div className="flex items-center gap-3">
                <PostDate post={post} />
                {isAdmin ? <AdminEditLink postId={post.id} /> : null}
              </div>
            </div>

            <h3 className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.04] tracking-[-0.035em] text-foreground transition-colors group-hover:text-primary-ink dark:group-hover:text-primary-on-dark sm:text-4xl">
              <Link href={`/${post.slug}`} className="focus:outline-hidden">
                {post.title}
              </Link>
            </h3>

            {post.excerpt ? (
              <p className="mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark sm:text-base">
                {post.excerpt}
              </p>
            ) : null}
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 dark:border-white/10">
            <Link
              href={`/${post.slug}`}
              className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-primary-ink transition-all group-hover:gap-3 focus:outline-hidden dark:text-primary-on-dark"
            >
              <span>Read the full story</span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <span className="text-[11px] font-mono uppercase text-muted-foreground dark:text-ink-muted-on-dark">
              Chapter dispatch
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function PostCard({ post, isAdmin }: { post: PublishedPostSummary; isAdmin: boolean }) {
  return (
    <article className="civic-panel group flex flex-col overflow-hidden transition-colors hover:border-primary/40 dark:hover:border-primary-bright/40">
      {post.featured_image ? (
        <div className="relative aspect-[16/9] overflow-hidden border-b border-border">
          <Image
            src={post.featured_image}
            alt=""
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col justify-between p-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <PostDate post={post} />
            {isAdmin ? <AdminEditLink postId={post.id} /> : null}
          </div>

          <h3 className="line-clamp-2 font-display text-2xl font-semibold leading-snug tracking-[-0.02em] text-foreground transition-colors group-hover:text-primary-ink dark:group-hover:text-primary-on-dark">
            <Link href={`/${post.slug}`} className="focus:outline-hidden">
              {post.title}
            </Link>
          </h3>

          {post.excerpt ? (
            <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
              {post.excerpt}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4 dark:border-white/10">
          <Link
            href={`/${post.slug}`}
            className="inline-flex min-h-11 items-center gap-1.5 text-xs font-bold text-primary-ink transition-all group-hover:gap-2.5 focus:outline-hidden dark:text-primary-on-dark"
          >
            <span>Read Story</span>
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
          <span className="text-[11px] font-mono uppercase text-muted-foreground dark:text-ink-muted-on-dark">
            Dispatch
          </span>
        </div>
      </div>
    </article>
  );
}

export function InteractivePostsList({ initialPosts }: InteractivePostsListProps) {
  const { isAdmin } = useEditContext('/news');
  const [leadPost, ...supportingPosts] = initialPosts;

  return (
    <section aria-labelledby="latest-news-heading" className="space-y-8">
      <div className="civic-section-head">
        <div>
          <p className="civic-section-index">Chapter newsroom</p>
          <h2
            id="latest-news-heading"
            className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl"
          >
            Latest News
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
            Reports, statements, and dispatches from our chapter organizers — published here
            first.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <a
            href="mailto:contact@indivisiblefairoaks.org?subject=Chapter%20news%20submission"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 border border-border bg-surface-card px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-primary hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Mail size={14} aria-hidden="true" />
            <span>Submit chapter news</span>
          </a>
          {isAdmin ? (
            <>
              <Link
                href="/admin/news#news-publishing-guide"
                className="inline-flex min-h-11 items-center justify-center gap-1.5 border border-border bg-surface-card px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-primary hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <BookOpen size={14} aria-hidden="true" />
                <span>How to publish</span>
              </Link>
              <Link
                href="/admin/content/new?type=post"
                className="inline-flex min-h-11 items-center justify-center gap-1.5 border border-primary bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Plus size={15} aria-hidden="true" />
                <span>Add News</span>
              </Link>
            </>
          ) : null}
        </div>
      </div>

      {!leadPost ? (
        <div className="civic-panel p-8 text-center text-muted-foreground dark:text-ink-muted-on-dark">
          <FileText className="mx-auto mb-3 opacity-40" size={32} aria-hidden="true" />
          <p className="text-sm">
            No published articles yet. Check back soon for deep-dive campaign reports and
            commentary!
          </p>
          {isAdmin ? (
            <Link
              href="/admin/content/new?type=post"
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 border border-primary bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Plus size={14} aria-hidden="true" />
              <span>Add the First News Post</span>
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="space-y-8">
          <LeadStory post={leadPost} isAdmin={isAdmin} />

          {supportingPosts.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {supportingPosts.map((post) => (
                <PostCard key={post.id} post={post} isAdmin={isAdmin} />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
