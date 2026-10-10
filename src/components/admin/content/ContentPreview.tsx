'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { sanitizeWPContent } from '@/lib/sanitize';

interface ContentPreviewProps {
  title: string;
  body: string;
  type: string;
  featuredImage: string;
  /**
   * The row's creation time — the same field `src/app/[slug]/page.tsx` prints as
   * "Published". It is *not* `published_at`: those are different values, and a
   * preview that shows one where the public page shows the other is a preview
   * the author ships on the strength of.
   */
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
 *
 * Built on Radix rather than a hand-rolled `role="dialog"`. That version
 * declared `aria-modal="true"` and moved focus to the close button, but trapped
 * nothing: Tab walked out of the preview and into the editor behind it, so a
 * keyboard user landed in the body of a document they believed they had left.
 * Radix gives the trap, the focus restore on close, and Escape — which is why
 * every other modal in this repo is one.
 */
export function ContentPreview({
  title,
  body,
  type,
  featuredImage,
  createdAt,
  onClose,
}: ContentPreviewProps) {
  const cleanBody = sanitizeWPContent(body);

  // `next/image` is deliberately not used here. This renders inside a portal
  // over a document that is not ours to route, and the public page's own 16/9
  // frame is reproduced with a plain box so the two agree on reserved space —
  // which is the property that actually matters for a preview, since a hero
  // that reflows differently is exactly what the author is checking for.
  // Which URL failed to load, not a boolean. A boolean has to be reset when the
  // author picks a different image, and the reset belongs in an effect keyed on
  // that URL — which is exactly the dependency an effect can silently drop. Storing
  // the URL instead makes "this image is broken" a derived value that cannot go
  // stale, and removes the effect entirely.
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const showHero = Boolean(featuredImage) && failedFor !== featuredImage;

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-secondary/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          // The stacking scale in AGENTS.md: content sits 10 above its overlay,
          // and a modal layer clears every non-modal one. 130 is the top of the
          // scale, shared with the command palette, which cannot be open at the
          // same time as this.
          className="fixed inset-0 z-[130] overflow-y-auto bg-surface-card focus:outline-none"
        >
          <Dialog.Title className="sr-only">Preview of {title || 'Untitled page'}</Dialog.Title>

          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface-card/95 px-4 py-3 backdrop-blur">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span
                className="inline-block h-2 w-2 rounded-full bg-accent-gold"
                aria-hidden="true"
              />
              Draft preview — not published
            </span>
            <Dialog.Close className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary">
              Close preview
            </Dialog.Close>
          </div>

          <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="mb-12 flex flex-col">
              <h1 className="mb-4 text-4xl font-black uppercase leading-tight tracking-tight text-foreground md:text-5xl">
                {title || 'Untitled page'}
              </h1>
              <div className="h-2 w-24 bg-primary" />
              {type === 'post' && createdAt && (
                <time
                  dateTime={createdAt}
                  className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground"
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

            {showHero && (
              <div className="mb-12 aspect-[16/9] w-full overflow-hidden rounded-3xl bg-surface-muted shadow-lg">
                {/* biome-ignore lint/performance/noImgElement: mirrors the public hero frame; a CMS upload has no intrinsic size and the reserved aspect box is what keeps the two layouts in agreement */}
                <img
                  src={featuredImage}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() => setFailedFor(featuredImage)}
                />
              </div>
            )}

            <div
              className="cw prose prose-slate prose-lg max-w-none
                prose-headings:text-foreground prose-headings:uppercase prose-headings:font-black
                prose-p:text-muted-foreground prose-p:leading-relaxed
                prose-a:text-primary dark:text-primary-on-dark prose-a:font-bold prose-a:no-underline hover:prose-a:underline
                prose-strong:text-foreground prose-strong:font-black
                prose-img:rounded-3xl prose-img:shadow-lg"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: cleanBody is produced by sanitizeWPContent, the same security boundary the public page renders through
              dangerouslySetInnerHTML={{ __html: cleanBody }}
            />

            {type === 'post' && (
              <div className="mt-20 flex items-center justify-between border-t border-border pt-10">
                <span className="text-sm font-black uppercase tracking-widest text-foreground">
                  &larr; Back to Home
                </span>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
