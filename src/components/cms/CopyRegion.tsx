import type { ReactNode } from 'react';
import { copyRegionSlug } from '@/lib/copy-regions';
import { getCopyRegionBody } from '@/lib/queries/content';
import { sanitizeWPContent } from '@/lib/sanitize';

/**
 * One addressable slice of a coded page, CMS-backed with a JSX fallback.
 *
 * **Why a component rather than a page-level row.** A `content` row is
 * addressable by slug, and a slug that matches an App Router segment is
 * shadowed — `src/lib/content.ts` refuses to write one. So the pages that need
 * editing most are precisely the ones that cannot own a row. A region owns its
 * own row under the `copy-` prefix instead: `copy-home-hero` is not a route,
 * never can be, and is filtered out of `generateStaticParams` and the sitemap
 * so it can never appear as a public URL.
 *
 * **The fallback is rendered only when there is no row.** That is what makes
 * shipping this a no-op for every site that has not authored a region yet: the
 * old JSX stays the rendered output, byte for byte, until someone saves copy.
 * Turning a region off is done by unpublishing its row, which returns the page
 * to its original state without a deploy.
 *
 * The body goes through the same `sanitizeWPContent` the `[slug]` route uses.
 * A CMS row is untrusted HTML by definition, and this component is the only
 * place region copy reaches the page.
 */
export async function CopyRegion({
  id,
  children,
}: {
  /** Region id from the registry in `src/lib/copy-regions.ts`. */
  id: string;
  /** Rendered verbatim when the region has no published row. */
  children: ReactNode;
}) {
  const slug = copyRegionSlug(id);

  // Cached in `getCopyRegionBody`, not here: `'use cache'` is what keeps
  // `new Date()` out of the prerender and costs one query per region per build
  // rather than one per route.
  const body = await getCopyRegionBody(slug);

  // `display: contents` in both branches, deliberately. It is what makes the
  // two modes interchangeable for layout *and* for the visual editor: the
  // wrapper is invisible to the grid or flex that contains it, and the element
  // carrying `data-copy-region` has the rendered copy as its direct children in
  // both modes — which is exactly the shape `buildVisualSections` pairs blocks
  // against. Nesting the HTML one level deeper would silently shift every
  // section's DOM ordinal.
  return body ? (
    <div
      data-copy-region={id}
      data-copy-region-source="cms"
      className="contents"
      // A CMS body is untrusted HTML by definition; `sanitizeWPContent` is the
      // only thing between it and the page, exactly as on the `[slug]` route.
      // The suppression is on this line, not the file, and it is the same
      // boundary the whole CMS rests on.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitizeWPContent(body) above is the security boundary; it strips script/style/iframe and migrates furniture
      dangerouslySetInnerHTML={{ __html: sanitizeWPContent(body) }}
    />
  ) : (
    <div data-copy-region={id} data-copy-region-source="fallback" className="contents">
      {children}
    </div>
  );
}
