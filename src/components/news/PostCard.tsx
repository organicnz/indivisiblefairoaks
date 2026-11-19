import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { GalleryImage } from '@/components/gallery/GalleryImage';
import { HighlightedText } from '@/components/ui/HighlightedText';
import { NewsSearchExcerpt } from '@/components/ui/NewsSearchExcerpt';
import type { PublishedPostSummary } from '@/lib/queries/content';
import { AdminEditLink, PostDate } from './NewsPostMeta';

type PostCardProps = {
  post: PublishedPostSummary;
  isAdmin: boolean;
  searchQuery?: string;
};

export function PostCard({ post, isAdmin, searchQuery }: PostCardProps) {
  return (
    <article className="civic-panel group flex min-w-0 flex-col overflow-hidden transition-colors hover:border-primary/40 dark:hover:border-primary-bright/40">
      {post.featured_image ? (
        <div className="relative aspect-[16/9] overflow-hidden border-b border-border">
          <GalleryImage
            src={post.featured_image}
            alt=""
            sizes="(min-width: 768px) 50vw, 100vw"
            fallbackLabel="Story image unavailable"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transform-none motion-reduce:transition-none"
          />
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col justify-between p-6">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <PostDate post={post} />
            {isAdmin ? <AdminEditLink postId={post.id} /> : null}
          </div>

          <h3 className="line-clamp-2 font-display text-2xl font-semibold leading-snug tracking-[-0.02em] text-foreground transition-colors group-hover:text-primary-ink dark:group-hover:text-primary-on-dark">
            <Link
              href={`/${post.slug}`}
              className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card"
            >
              <HighlightedText text={post.title} query={searchQuery} />
            </Link>
          </h3>

          {post.excerpt ? (
            <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground dark:text-ink-on-dark">
              <NewsSearchExcerpt text={post.excerpt} query={searchQuery} maxLength={180} />
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4 dark:border-white/10">
          <Link
            href={`/${post.slug}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-xs font-bold text-primary-ink transition-all group-hover:gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card dark:text-primary-on-dark"
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
