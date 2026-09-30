import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ROBOTS, siteUrl } from '@/config/site';
import { pageMetadata } from '@/lib/metadata';
import { isOwnImageUrl } from '@/lib/own-media';
import { getAllPublishedSlugs, getPublishedContent } from '@/lib/queries/content';
import { htmlToExcerpt, sanitizeWPContent } from '@/lib/sanitize';
import { serializeJsonLd } from '@/lib/utils';

export async function generateStaticParams() {
  return getAllPublishedSlugs();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const slug = (await params).slug;
  const content = await getPublishedContent(slug);

  if (!content) {
    // A missing row must not render an indexable page. Without this, an
    // unpublished or mistyped slug returns the site chrome with a 200 and a
    // "Not Found" title — a soft 404 that Google is happy to index.
    return { title: 'Page Not Found', robots: ROBOTS.noindex };
  }

  const metadata = (content.metadata ?? {}) as Record<string, string>;
  const metaTitle = metadata.meta_title?.trim();
  const metaDescription = metadata.meta_description?.trim();
  const hero = content.featured_image?.trim() || '';
  const heroSrc = hero && isOwnImageUrl(hero) ? hero : '';

  return pageMetadata({
    // Meta fields win when set — that is what Google uses. The derived title /
    // body excerpt is the fallback for pages authored before SEO existed.
    title: metaTitle || content.title,
    description: metaDescription || htmlToExcerpt(content.body || ''),
    path: `/${slug}`,
    type: content.type === 'post' ? 'article' : 'website',
    publishedTime: content.created_at ?? undefined,
    modifiedTime: content.updated_at ?? content.created_at ?? undefined,
    authors: ['Indivisible Fair Oaks-Carmichael'],
    // The authored hero is the best card this page can offer. Next *replaces*
    // openGraph rather than merging it, so this has to be stated here — the
    // `opengraph-image` file convention's output is otherwise discarded the
    // moment a page declares its own `images`.
    ...(heroSrc ? { images: [{ url: heroSrc, width: 1200, height: 630 }] } : {}),
  });
}

/**
 * A missing row is served as HTTP 200 with a "Page Not Found" title, not a 404.
 *
 * This route uses `generateStaticParams`, and with `cacheComponents` on it is
 * Partial Prerendered: the static shell is flushed with a 200 before the
 * streaming part that calls `notFound()` runs, and a status already sent cannot
 * be rewritten. `instant = false` and hoisting the lookup above the Suspense
 * boundary were both tried and neither changes it.
 *
 * The consequence is bounded: `generateMetadata` emits `noindex, nofollow` for a
 * missing row, so search engines will not index it. What is affected is
 * monitoring — an uptime check or analytics report records a broken CMS link as a
 * success. Closing it properly means either a per-request existence check in
 * middleware (a Supabase round trip on every request, on a shared 4 hr/30-day
 * Fluid CPU pool) or dropping prerendering for this segment, which is why it is
 * left as a documented limitation rather than changed unilaterally.
 */
export default function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <ContentBody params={params} />
    </Suspense>
  );
}

function ContentSkeleton() {
  return (
    <div className="bg-white min-h-screen pt-(--header-h) pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto animate-pulse">
        <div className="flex flex-col mb-12">
          <div className="h-12 w-3/4 bg-slate-100 rounded" />
          <div className="h-2 w-24 bg-slate-100 mt-4" />
        </div>
        <div className="space-y-4">
          {['95%', '88%', '81%', '74%', '67%', '60%', '53%', '40%'].map((width) => (
            <div key={width} className="h-4 bg-slate-100 rounded" style={{ width }} />
          ))}
        </div>
      </div>
    </div>
  );
}

async function ContentBody({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const content = await getPublishedContent(slug);

  if (!content) {
    return notFound();
  }

  const cleanBody = sanitizeWPContent(content.body || '');
  const canonical = siteUrl(`/${slug}`);
  // Only ours: the sanitizer's outbound-link rule is for anchors a reader can
  // follow, but this is a URL the page hands to next/image, and an authored
  // value from an unvetted host is not one we want to fetch.
  const hero = content.featured_image?.trim() || '';
  const heroSrc = hero && isOwnImageUrl(hero) ? hero : '';

  // Breadcrumbs for every CMS page, not just product pages. Referencing the
  // organization node by @id links this page into the entity graph declared in the
  // root layout rather than emitting a second, conflicting definition.
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl('/') },
      { '@type': 'ListItem', position: 2, name: content.title, item: canonical },
    ],
  };

  // Google requires `image` and a `publisher.logo` of at least 112x112 for Article
  // rich results. Both were missing, so no migrated post qualified for a rich
  // result at all.
  const articleJsonLd =
    content.type === 'post'
      ? {
          '@context': 'https://schema.org',
          '@type': 'Article',
          '@id': `${canonical}#article`,
          mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
          url: canonical,
          headline: content.title,
          description: htmlToExcerpt(content.body || ''),
          image: [heroSrc || siteUrl('/icon-512.png')],
          inLanguage: 'en-US',
          datePublished: content.created_at ?? undefined,
          dateModified: content.updated_at ?? content.created_at ?? undefined,
          author: { '@id': `${siteUrl('/')}#organization` },
          publisher: { '@id': `${siteUrl('/')}#organization` },
        }
      : null;

  const jsonLd = [breadcrumbJsonLd, articleJsonLd].filter(Boolean);

  return (
    <div className="bg-white min-h-screen pt-(--header-h) pb-16 px-4 sm:px-6 lg:px-8">
      {jsonLd.length > 0 && (
        <script
          type="application/ld+json"
          // Structured data, not WP content: sanitizeWPContent intentionally not applied
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
      )}
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col mb-12">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-secondary uppercase mb-4 leading-tight">
            {content.title}
          </h1>
          <div className="h-2 w-24 bg-primary" />
          {content.type === 'post' && content.created_at && (
            <time
              dateTime={content.created_at}
              className="mt-6 text-xs font-black text-slate-400 uppercase tracking-[0.2em]"
            >
              Published{' '}
              {new Date(content.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          )}
        </div>

        {/*
          The hero. `featured_image` was stored, revision-tracked, reference-
          checked on delete and rendered in the editor's preview — and read by no
          public route at all, so the field was a control that did nothing
          visible. The preview showing an image the published page would not have
          is exactly the "a control must do what it says" failure.

          `fill` inside a fixed `aspect-[16/9]` frame rather than width/height:
          the CMS accepts an arbitrary upload and nothing measures one, so an
          intrinsic size would be a guess. The frame reserves the space up front,
          which is what keeps this from introducing layout shift.
        */}
        {heroSrc && (
          <div className="relative mb-12 aspect-[16/9] w-full overflow-hidden rounded-3xl bg-surface-muted shadow-lg">
            <Image
              src={heroSrc}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 896px"
              className="object-cover"
              priority={content.type === 'post'}
            />
          </div>
        )}

        <div
          className="cw prose prose-slate prose-lg max-w-none 
            prose-headings:text-secondary prose-headings:uppercase prose-headings:font-black
            prose-p:text-slate-600 prose-p:leading-relaxed
            prose-a:text-primary prose-a:font-bold prose-a:no-underline hover:prose-a:underline
            prose-strong:text-secondary prose-strong:font-black
            prose-img:rounded-3xl prose-img:shadow-lg"
          // cleanBody is produced by sanitizeWPContent (line 28)
          dangerouslySetInnerHTML={{ __html: cleanBody }}
        />
        {content.type === 'post' && (
          <div className="mt-20 pt-10 border-t border-slate-100 flex justify-between items-center">
            <Link
              href="/"
              className="text-sm font-black text-secondary uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-2"
            >
              <span>&larr;</span> Back to Home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
