import { AlertTriangle, ArrowLeft, ExternalLink, Paintbrush } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
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
 * shadowed by a coded route or a legacy 301, so the composer had no reachable
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
  const content = id === null ? null : await getContentForEdit(id);
  return {
    title: content ? `${content.title} — Visual composer` : 'Visual composer',
    description: 'Compose a CMS page visually.',
    robots: { index: false, follow: false },
  };
}

export default async function ComposerWorkspacePage({ params }: PageProps) {
  const id = rowIdFromParam((await params).id);
  if (id === null) notFound();

  const content = await getContentForEdit(id);
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

  return (
    <div className="min-h-screen bg-background pt-(--header-h) pb-24 text-foreground">
      <ComposerWorkspaceBoot />
      {/* Same column width as the public page: a canvas one size wider would
          preview line breaks the saved page will not have. */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border py-8">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-primary dark:text-primary-on-dark">
              <Paintbrush size={12} aria-hidden="true" />
              Visual composer
            </p>
            <h1 className="mt-2 truncate text-3xl font-black uppercase tracking-tight sm:text-4xl">
              {content.title}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Row #{content.id}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">/{content.slug}</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  content.status === 'publish'
                    ? 'font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400'
                    : 'font-bold uppercase tracking-wider text-accent-gold'
                }
              >
                {content.status === 'publish' ? 'Published' : 'Draft'}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/content/${content.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Back to editor
            </Link>
            {publicHref ? (
              <Link
                href={publicHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-dark focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                View page
                <ExternalLink size={13} aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </div>

        {conflict ? (
          <p
            role="status"
            className="mt-4 flex items-start gap-2 rounded-xl border border-accent-gold/40 bg-accent-gold/10 px-4 py-3 text-xs font-medium text-foreground"
          >
            <AlertTriangle
              size={15}
              className="mt-0.5 shrink-0 text-accent-gold"
              aria-hidden="true"
            />
            <span>
              <strong className="font-black">This row is not what /{content.slug} serves.</strong>{' '}
              {conflict} Edits still save to the CMS row; change the slug in the editor to publish
              it at a reachable path.
            </span>
          </p>
        ) : null}

        <p className="mt-6 text-xs text-muted-foreground">
          Click any block to edit its copy, or use the section tools to open the composer. The page
          saves to row #{content.id}.
        </p>

        {/* Sanitized inside ContentSurface; `html` above is only the emptiness probe. */}
        <ContentSurface html={content.body || ''} contentId={content.id} className="mt-6" />

        {html.trim().length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            This row has no copy yet. Use <strong className="font-bold">Add Block</strong> in the
            visual editor to start the page.
          </p>
        ) : null}
      </div>
    </div>
  );
}
