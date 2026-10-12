'use server';

import type { ContentRevision, ContentRow } from '@/lib/actions/content';
import {
  getContentBySlugForEdit,
  getContentForEdit,
  getContentRevisions,
} from '@/lib/actions/content';
import {
  getCRMEdgeFunctionHealth,
  getCRMMediaFiles,
  getCRMSegments,
  getCRMStats,
} from '@/lib/actions/crm';
import { requireAdmin } from '@/lib/admin-auth';
import type {
  BackendStatus,
  CRMSegment,
  CRMStats,
  MediaListResult,
  VisualCatalogCounts,
  VisualPageContext,
} from '@/types/unified';

export type { VisualCatalogCounts, VisualPageContext } from '@/types/unified';

/**
 * One backend context for the in-page visual editor.
 *
 * The overlay used to assemble this from five separate client-side calls
 * (content, revisions, media, CRM stats, edge health), each with its own
 * loading, failure and retry state — and each paying the `requireAdmin()`
 * gate (getUser + MFA + profile) on its own request. One server action means
 * one gate per open, one loading state, and one place where "what does the
 * editor know?" is answered.
 *
 * Deliberately a *summary*, not a dump: media is capped at 60, revisions at
 * the existing 20-cap, catalog tables are counts (not rows). The overlay
 * calls the existing paged actions (`getCRMMediaFiles`, `getCRMContacts`,
 * `getContentList`, …) when the operator actually opens a picker. Fetching
 * 5,000 contacts "so the editor has all the data" is how a 300ms open
 * becomes a 9s one on the shared Fluid pool.
 *
 * Every capped read reports (`truncated`), per the CRM convention: a count
 * without one is a claim of completeness.
 */

function slugForPath(pathname: string): string | null {
  const clean = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  if (clean === '/') return null;
  const parts = clean.replace(/^\/+/, '').split('/');
  // `cmsSlugForPath` (edit-context) only binds single-segment paths; nested
  // routes (admin, account, api) are never CMS rows. Mirror that here so the
  // overlay does not claim `/admin/crm` is a page called "crm".
  if (parts.length !== 1 || !parts[0]) return null;
  if (parts[0].startsWith('_') || parts[0].includes('.')) return null;
  return parts[0].slice(0, 120);
}

export async function getVisualPageContext(input?: {
  pathname?: string;
  contentId?: number;
  slug?: string;
}): Promise<VisualPageContext> {
  const { adminClient } = await requireAdmin();

  const emptyMedia: MediaListResult = { items: [], folders: ['crm', 'content', 'products'] };

  // Resolve the content row first — everything else is independent and runs
  // together. A failure in one summary read must not fail the whole open:
  // each falls back to its empty state while the rest still arrive.
  let content: ContentRow | null = null;
  try {
    if (typeof input?.contentId === 'number' && Number.isInteger(input.contentId)) {
      content = await getContentForEdit(input.contentId);
    } else {
      const slug = input?.slug ?? (input?.pathname ? slugForPath(input.pathname) : null);
      if (slug) content = await getContentBySlugForEdit(slug);
    }
  } catch {
    content = null;
  }

  const [revisionsRes, mediaRes, healthRes, statsRes, segmentsRes, catalogRes] = await Promise.all([
    (async () => {
      if (!content) return { revisions: [] as ContentRevision[], truncated: false };
      try {
        const res = await getContentRevisions(content.id, 20);
        if (!res.success || !res.data)
          return { revisions: [] as ContentRevision[], truncated: false };
        return { revisions: res.data.revisions, truncated: res.data.revisions.length >= 20 };
      } catch {
        return { revisions: [] as ContentRevision[], truncated: false };
      }
    })(),
    (async (): Promise<MediaListResult> => {
      try {
        return await getCRMMediaFiles({ folder: 'all', limit: 60 });
      } catch {
        return emptyMedia;
      }
    })(),
    (async (): Promise<BackendStatus> => {
      try {
        return await getCRMEdgeFunctionHealth();
      } catch (err) {
        return {
          database: false,
          storage: false,
          edgeFunction: false,
          error: err instanceof Error ? err.message : 'Health check failed',
        };
      }
    })(),
    (async (): Promise<CRMStats | null> => {
      try {
        return await getCRMStats();
      } catch {
        return null;
      }
    })(),
    (async (): Promise<{ segments: CRMSegment[]; truncated: boolean }> => {
      try {
        const res = await getCRMSegments();
        return { segments: res.segments, truncated: res.truncated };
      } catch {
        return { segments: [], truncated: false };
      }
    })(),
    (async (): Promise<VisualCatalogCounts> => {
      const fallback: VisualCatalogCounts = { products: 0, galleryPhotos: 0, events: 0 };
      try {
        const [products, gallery, events] = await Promise.all([
          adminClient.from('products').select('id', { count: 'exact', head: true }),
          adminClient.from('gallery_photos').select('id', { count: 'exact', head: true }),
          adminClient.from('events').select('slug', { count: 'exact', head: true }),
        ]);
        return {
          products: products.count ?? 0,
          galleryPhotos: gallery.count ?? 0,
          events: events.count ?? 0,
        };
      } catch {
        return fallback;
      }
    })(),
  ]);

  return {
    content: content as VisualPageContext['content'],
    revisions: revisionsRes.revisions as VisualPageContext['revisions'],
    revisionsTruncated: revisionsRes.truncated,
    media: mediaRes,
    backend: healthRes,
    crmStats: statsRes,
    segments: segmentsRes.segments,
    segmentsTruncated: segmentsRes.truncated,
    catalog: catalogRes,
  };
}
