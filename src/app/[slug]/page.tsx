import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getAllPublishedSlugs, getPublishedContent } from '@/lib/queries/content';
import { sanitizeWPContent } from '@/lib/sanitize';

export async function generateStaticParams() {
  return getAllPublishedSlugs();
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const slug = (await params).slug;
  const content = await getPublishedContent(slug);

  if (!content) {
    return { title: 'Not Found' };
  }

  const cleanBody = sanitizeWPContent(content.body || '');
  const rawText = cleanBody
    .replace(/<[^>]*>?/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  const description = rawText.length > 150 ? `${rawText.substring(0, 147)}...` : rawText;

  return {
    alternates: { canonical: `/${slug}` },
    title: `${content.title} | Indivisible Fair Oaks-Carmichael`,
    description: description,
    openGraph: {
      title: content.title,
      description: description,
    },
  };
}

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

  const jsonLd =
    content.type === 'post'
      ? {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: content.title,
          datePublished: content.created_at ?? undefined,
          dateModified: content.created_at ?? undefined,
          author: { '@type': 'Organization', name: 'Indivisible Fair Oaks-Carmichael' },
          publisher: { '@type': 'Organization', name: 'Indivisible Fair Oaks-Carmichael' },
        }
      : null;

  return (
    <div className="bg-white min-h-screen pt-(--header-h) pb-16 px-4 sm:px-6 lg:px-8">
      {jsonLd && (
        <script
          type="application/ld+json"
          // Structured data, not WP content: sanitizeWPContent intentionally not applied
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
              {new Date(content.created_at).toLocaleDateString('en-NZ', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          )}
        </div>

        <div
          className="prose prose-slate prose-lg max-w-none 
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
            <div className="flex gap-4">{/* Social share placeholders */}</div>
          </div>
        )}
      </div>
    </div>
  );
}
