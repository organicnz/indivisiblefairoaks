'use client';

import { useEffect, useRef } from 'react';
import { sanitizeWPContent } from '@/lib/sanitize';

interface ContentPreviewProps {
  title: string;
  body: string;
  type: string;
  featuredImage: string;
  createdAt: string | null;
  onClose: () => void;
}

/**
 * A full-page preview of the document as the public will see it.
 *
 * The point of a preview is that it is honest, so this renders through the
 * same `sanitizeWPContent` and the same `cw` + prose classes as
 * `src/app/[slug]/page.tsx`. A preview that styled itself differently would
 * be a lie the author ships on.
 *
 * It is a modal, not a route: the document may be unsaved, and a URL that
 * renders unsaved work is a URL that can be shared by accident.
 */
export function ContentPreview({
  title,
  body,
  type,
  featuredImage,
  createdAt,
  onClose,
}: ContentPreviewProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const cleanBody = sanitizeWPContent(body);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Page preview"
      className="fixed inset-0 z-[130] overflow-y-auto bg-white"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <span className="inline-block h-2 w-2 rounded-full bg-accent-gold" aria-hidden="true" />
          Draft preview — not published
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-primary"
        >
          Close preview
        </button>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12 flex flex-col">
          <h1 className="mb-4 text-4xl font-black uppercase leading-tight tracking-tight text-secondary md:text-5xl">
            {title || 'Untitled page'}
          </h1>
          <div className="h-2 w-24 bg-primary" />
          {type === 'post' && createdAt && (
            <time
              dateTime={createdAt}
              className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-slate-400"
            >
              Published{' '}
              {new Date(createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          )}
        </div>

        {featuredImage && (
          // biome-ignore lint/performance/noImgElement: public bucket URL, validated on save to be on this site's own domain; next/image needs dimensions we don't have for arbitrary uploads
          <img src={featuredImage} alt="" className="mb-10 w-full rounded-3xl shadow-lg" />
        )}

        <div
          className="cw prose prose-slate prose-lg max-w-none
            prose-headings:text-secondary prose-headings:uppercase prose-headings:font-black
            prose-p:text-slate-600 prose-p:leading-relaxed
            prose-a:text-primary prose-a:font-bold prose-a:no-underline hover:prose-a:underline
            prose-strong:text-secondary prose-strong:font-black
            prose-img:rounded-3xl prose-img:shadow-lg"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: cleanBody is produced by sanitizeWPContent, the same security boundary the public page renders through
          dangerouslySetInnerHTML={{ __html: cleanBody }}
        />

        {type === 'post' && (
          <div className="mt-20 flex items-center justify-between border-t border-slate-100 pt-10">
            <span className="text-sm font-black uppercase tracking-widest text-secondary">
              &larr; Back to Home
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
