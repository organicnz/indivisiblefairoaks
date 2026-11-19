import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { GalleryImage } from '@/components/gallery/GalleryImage';
import { HighlightedText } from '@/components/ui/HighlightedText';
import { NewsSearchExcerpt } from '@/components/ui/NewsSearchExcerpt';
import type { PublishedPostSummary } from '@/lib/queries/content';
import { AdminEditLink, PostDate } from './NewsPostMeta';

type LeadStoryProps = {
  post: PublishedPostSummary;
  isAdmin: boolean;
  searchQuery?: string;
};

export function LeadStory({ post, isAdmin, searchQuery }: LeadStoryProps) {
  return (
    <article className="civic-panel group min-w-0 overflow-hidden">
      <div className="grid min-w-0 lg:grid-cols-12">
        {post.featured_image ? (
          <div className="relative aspect-[16/10] min-w-0 overflow-hidden border-b border-border lg:col-span-5 lg:aspect-auto lg:min-h-[24rem] lg:border-b-0 lg:border-r">
            <GalleryImage
              src={post.featured_image}
              alt=""
              sizes="(min-width: 1024px) 42vw, 100vw"
              fallbackLabel="Story image unavailable"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transform-none motion-reduce:transition-none"
            />
          </div>
        ) : null}

        <div
          className={`flex min-w-0 flex-col justify-between p-6 sm:p-8 ${
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
              <Link
                href={`/${post.slug}`}
                className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card"
              >
                <HighlightedText text={post.title} query={searchQuery} />
              </Link>
            </h3>

            {post.excerpt ? (
              <p className="mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark sm:text-base">
                <NewsSearchExcerpt text={post.excerpt} query={searchQuery} maxLength={260} />
              </p>
            ) : null}
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 dark:border-white/10">
            <Link
              href={`/${post.slug}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-sm text-xs font-bold text-primary-ink transition-all group-hover:gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card dark:text-primary-on-dark"
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
