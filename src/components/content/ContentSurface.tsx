import { sanitizeWPContent } from '@/lib/sanitize';
import { VISUAL_EDIT_CONTENT_ID_ATTR } from '@/lib/visual-edit-document';

/**
 * The page body a reader sees, and the surface the visual composer addresses.
 *
 * One component rather than a class string copied into every route: the root
 * marker, the prose classes and the optional CMS row id have to agree, and
 * `[slug]` and the composer workspace are two renderers of the same body. A
 * class added in one place and not the other is the preview/save mismatch this
 * whole editing model exists to prevent — the editor would paint a surface the
 * page does not have.
 *
 * **The sanitizer boundary lives here, not at the call sites.** `sanitizeWPContent`
 * treats untrusted CMS HTML as a security boundary, and a renderer that trusted
 * its input would make forgetting it a one-line mistake in every new route. It
 * runs on every render, which is cheap next to the page render and makes the
 * element that emits the HTML the same element that secures it. Passing already
 * sanitized HTML is fine; the pass is safe to repeat.
 */
export function ContentSurface({
  html,
  contentId,
  className = '',
}: {
  /** The CMS body to render. Sanitized here; callers may pass it raw. */
  html: string;
  /** The `content` row this surface edits, for the dedicated composer route. */
  contentId?: number;
  className?: string;
}) {
  return (
    <div
      className={`cw prose prose-slate prose-lg max-w-none
        prose-headings:font-display prose-headings:font-semibold prose-headings:normal-case prose-headings:tracking-[-0.03em] prose-headings:text-foreground
        prose-p:text-muted-foreground prose-p:leading-relaxed
        prose-a:text-primary dark:prose-a:text-primary-on-dark prose-a:font-bold prose-a:no-underline hover:prose-a:underline
        prose-strong:text-foreground prose-strong:font-semibold
        prose-blockquote:border-l-primary prose-blockquote:font-display prose-blockquote:not-italic
        prose-hr:border-border prose-img:rounded-[var(--radius-sm)] prose-img:shadow-none ${className}`.trim()}
      data-visual-edit-root=""
      {...(contentId ? { [VISUAL_EDIT_CONTENT_ID_ATTR]: String(contentId) } : {})}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitizeWPContent runs inline on the same expression
      dangerouslySetInnerHTML={{ __html: sanitizeWPContent(html) }}
    />
  );
}
