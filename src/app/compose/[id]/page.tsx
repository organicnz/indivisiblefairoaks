import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ComposerEmptyState } from '@/components/compose/ComposerEmptyState';
import { ComposerSlugConflict } from '@/components/compose/ComposerSlugConflict';
import { ComposerWorkspaceHeader } from '@/components/compose/ComposerWorkspaceHeader';
import { ContentSurface } from '@/components/content/ContentSurface';
import { ComposerWorkspaceBoot } from '@/components/visual-edit/ComposerWorkspaceBoot';
import { getContentForEdit } from '@/lib/actions/content';
import { contentPublicHref, describeSlugConflict } from '@/lib/content';
import {
  copyRegionComposeHref,
  copyRegionLocationForSlug,
  isCopyRegionSlug,
} from '@/lib/copy-regions';
import { sanitizeWPContent } from '@/lib/sanitize';

/**
 * The full-page composer workspace for one CMS row.
 *
 * The in-page editor resolves its document from the pathname, which works while
 * the URL names the row. Every migrated page fails that test: its slug is
 * shadowed by a coded route or a legacy redirect, so the composer had no reachable
 * surface for the content that actually exists. This route is that surface — a
 * page rendered from the row itself, with the site's real typography and the
 * visual-edit root, addressable by id rather than by a path that may redirect.
 *
 * It deliberately renders outside `/admin`: the editor's shell was not built to
 * host a page at its real width, and an editing canvas surrounded by admin
 * navigation is not the page the operator is trying to judge. The route is
 * still gated by `getContentForEdit`, which calls `requireAdmin`, and it is
 * noindex.
 *
 * The public path may not exist. The banner says so rather than letting an
 * operator publish into a redirect and wonder why the page did not change; the
 * row is still editable, because repurposing migrated copy is a legitimate use.
 *
 * A copy-region row never renders here. It is a slice of a coded page, so the
 * workspace for it is that page with the region selected — the same place the
 * list and editor now link to. Rendering `/copy-home-hero` as a standalone
 * document at `[slug]` width was the one case that was actively misleading: the
 * only live region on the site opened on a page whose "View" link 404'd.
 */
type PageProps = { params: Promise<{ id: string }> };

function rowIdFromParam(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const id = rowIdFromParam((await params).id);
  if (id === null) notFound();
  const content = await getContentForEdit(id, `/compose/${id}`);
  if (!content) notFound();
  return {
    title: `${content.title} — Visual composer`,
    description: 'Compose a CMS page visually.',
    robots: { index: false, follow: false },
  };
}

export default async function ComposerWorkspacePage({ params }: PageProps) {
  const id = rowIdFromParam((await params).id);
  if (id === null) notFound();

  const content = await getContentForEdit(id, `/compose/${id}`);
  if (!content) notFound();

  const regionHref = copyRegionComposeHref(content.slug);
  if (regionHref) redirect(regionHref);

  const html = sanitizeWPContent(content.body || '');
  const unregisteredRegion =
    isCopyRegionSlug(content.slug) && !copyRegionLocationForSlug(content.slug);
  const conflict =
    describeSlugConflict(content.slug) ??
    (unregisteredRegion
      ? 'No page in the copy-region registry renders this region, so its copy appears nowhere.'
      : null);
  const publicHref = contentPublicHref(content);

  /*
   * The composer's right rail is fixed. Reserve its width here so the page is
   * judged at its real line length instead of under the inspector; the variable
   * is published by the overlay and absent on every other route.
   */
  return (
    <div
      data-composer-workspace
      className="min-h-screen bg-background pt-(--header-clearance) pb-[calc(6rem+env(safe-area-inset-bottom))] text-foreground transition-[padding-right] duration-300 motion-reduce:transition-none lg:pr-[var(--visual-edit-rail-width,0px)]"
    >
      {/* Same column width as the public page: a canvas one size wider would
          preview line breaks the saved page will not have. */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <ComposerWorkspaceHeader
          id={content.id}
          title={content.title}
          slug={content.slug}
          status={content.status}
          publicHref={publicHref}
          hasConflict={Boolean(conflict)}
        />

        <ComposerWorkspaceBoot />

        {conflict ? <ComposerSlugConflict slug={content.slug} conflict={conflict} /> : null}

        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Select any block on the canvas to edit it in the composer rail. Saves write to row #
          {content.id}.
        </p>

        {/* Sanitized inside ContentSurface; `html` above is only the emptiness probe. */}
        <ContentSurface html={content.body || ''} contentId={content.id} className="mt-8" />

        {html.trim().length === 0 ? <ComposerEmptyState contentId={content.id} /> : null}
      </div>
    </div>
  );
}
