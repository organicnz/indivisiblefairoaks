'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { IS_PRODUCTION_SITE } from '@/config/site';
import { requireAdmin } from '@/lib/admin-auth';
import {
  CONTENT_TYPES,
  type ContentType,
  describeSlugConflict,
  MAX_BODY_BYTES,
} from '@/lib/content';
import { env } from '@/lib/env';
import { isOwnImageUrl } from '@/lib/own-media';
import { getStorageUrl } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

// This is a 'use server' module, so it may only export async functions.
// CONTENT_TYPES, slugifyTitle, describeSlugConflict and readingStats are sync
// helpers; they live in @/lib/content and must be imported from there.

export type ContentRow = Database['public']['Tables']['content']['Row'];
export type ContentRevision = Database['public']['Tables']['content_revisions']['Row'];

/** The subset of columns the directory list renders — never the body. */
export type ContentListRow = Pick<
  ContentRow,
  | 'id'
  | 'title'
  | 'slug'
  | 'excerpt'
  | 'type'
  | 'status'
  | 'published_at'
  | 'featured_image'
  | 'updated_at'
  | 'created_at'
>;

export type ActionResult<T = undefined> =
  | ({ success: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { success: false; error: string };

function fail(error: string) {
  return { success: false as const, error };
}

const slugSchema = z
  .string()
  .trim()
  .min(1, 'Slug is required')
  .max(120, 'Slug must be 120 characters or fewer')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lowercase letters, numbers and single hyphens — no spaces, underscores or accents'
  );

const contentSchema = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().trim().min(1, 'Title is required').max(200),
  slug: slugSchema,
  excerpt: z.string().trim().max(400).nullable().optional(),
  type: z.enum(CONTENT_TYPES).default('page'),
  status: z.enum(['publish', 'draft']).default('draft'),
  /** Rendered HTML from the block editor. */
  body: z.string().max(MAX_BODY_BYTES, 'This page is too large to save').default(''),
  featuredImage: z
    .string()
    .trim()
    .url('Featured image must be a full URL')
    .max(600)
    .nullable()
    .optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  /** Free-form SEO/structured fields the editor exposes as key/value rows. */
  metadata: z.record(z.string().max(80), z.string().max(2000)).default({}),
});

export type ContentInput = z.input<typeof contentSchema>;

export interface ContentListParams {
  status?: 'all' | 'publish' | 'draft';
  type?: 'all' | ContentType;
  query?: string;
  page?: number;
  pageSize?: number;
}

export interface ContentListResult {
  rows: ContentListRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}

const LIST_COLUMNS =
  'id, title, slug, excerpt, type, status, published_at, featured_image, updated_at, created_at';

export async function getContentList({
  status = 'all',
  type = 'all',
  query = '',
  page = 1,
  pageSize = 25,
}: ContentListParams = {}): Promise<ContentListResult> {
  const { adminClient } = await requireAdmin();
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));

  let queryBuilder = adminClient.from('content').select(LIST_COLUMNS, { count: 'exact' });
  if (status !== 'all') queryBuilder = queryBuilder.eq('status', status);
  if (type !== 'all') queryBuilder = queryBuilder.eq('type', type);
  const trimmed = query.trim();
  if (trimmed) {
    // `or` is PostgREST filter syntax, so strip its structural characters from
    // the user's text exactly as the CRM search and content queries already do.
    const safe = trimmed.replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim();
    if (safe) {
      queryBuilder = queryBuilder.or(`title.ilike.%${safe}%,slug.ilike.%${safe}%`);
    }
  }

  const { data, error, count } = await queryBuilder
    .order('updated_at', { ascending: false })
    .range((safePage - 1) * safePageSize, safePage * safePageSize - 1);

  if (error) throw new Error(`Failed to load content: ${error.message}`);
  return {
    rows: data ?? [],
    totalCount: count ?? 0,
    page: safePage,
    pageSize: safePageSize,
  };
}

export async function getContentForEdit(id: number): Promise<ContentRow | null> {
  const { adminClient } = await requireAdmin();
  const { data, error } = await adminClient.from('content').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Failed to load content: ${error.message}`);
  return data;
}

/**
 * A slug is unique on `content`, but the same path can already be claimed by a
 * legacy redirect or a real route. Only the first is a database constraint, so
 * the other two are checked here and reported by name.
 */
async function assertSlugAvailable(
  slug: string,
  client: Awaited<ReturnType<typeof requireAdmin>>['adminClient'],
  excludeId?: number
): Promise<string | null> {
  const conflict = describeSlugConflict(slug);
  if (conflict) return conflict;

  const { data } = await client.from('content').select('id').eq('slug', slug).maybeSingle();
  if (data && data.id !== excludeId) {
    return `/${slug} is already used by another page.`;
  }
  return null;
}

function revalidateContent(slug?: string | null, previousSlug?: string | null): void {
  // 'hours' matches the cacheLife profile every content query declares, so an
  // admin publish invalidates exactly the cache the page is held in rather than
  // promoting it to a longer-lived profile (see Conservation Mode in AGENTS.md).
  revalidateTag('content', 'hours');
  if (slug) revalidateTag(`content-${slug}`, 'hours');
  // A slug change leaves the old tag orphaned, so invalidate it too.
  if (previousSlug && previousSlug !== slug) revalidateTag(`content-${previousSlug}`, 'hours');
  revalidatePath('/admin/content');
  revalidatePath('/sitemap.xml');
  revalidatePath('/search');
}

export async function saveContent(rawInput: ContentInput): Promise<ActionResult<{ id: number }>> {
  const { adminClient } = await requireAdmin();
  const parsed = contentSchema.safeParse(rawInput);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || 'Invalid input');
  const data = parsed.data;

  if (data.featuredImage) {
    // Absolute, non-private URLs only, and only from a host this site controls.
    // The page renders this into an OG image tag, so a `data:` URL or a private
    // host would either break the crawler or leak an internal hostname into a
    // public card.
    //
    // "This site" means more than the configured origin: the editor's own
    // uploader writes to the `media` bucket on the Supabase project and returns
    // a `*.supabase.co` URL, so testing against `NEXT_PUBLIC_SITE_URL` alone
    // rejected every image the CMS itself had just produced. See
    // `src/lib/own-media.ts`.
    if (!/^https?:$/.test(new URL(data.featuredImage).protocol)) {
      return fail('Featured image must be an http(s) URL');
    }
    if (IS_PRODUCTION_SITE && !isOwnImageUrl(data.featuredImage)) {
      return fail('Featured image must be uploaded here, or hosted on this site');
    }
  }

  const slugConflict = await assertSlugAvailable(data.slug, adminClient, data.id);
  if (slugConflict) return fail(slugConflict);

  const row = {
    title: data.title,
    slug: data.slug,
    excerpt: data.excerpt || null,
    type: data.type,
    status: data.status,
    body: data.body || null,
    featured_image: data.featuredImage || null,
    published_at:
      data.publishedAt !== undefined
        ? data.publishedAt
        : // Publishing without an explicit date means "now"; a draft keeps
          // whatever date it had so un-drafting does not backdate it.
          data.status === 'publish'
          ? new Date().toISOString()
          : null,
    metadata: data.metadata,
  };

  if (data.id) {
    const { data: previous } = await adminClient
      .from('content')
      .select('slug')
      .eq('id', data.id)
      .maybeSingle();
    if (!previous) return fail('That page no longer exists');

    const { error } = await adminClient.from('content').update(row).eq('id', data.id);
    if (error) return fail(error.message);
    revalidateContent(data.slug, previous.slug);
    return { success: true, data: { id: data.id } };
  }

  const { data: created, error } = await adminClient
    .from('content')
    .insert(row)
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') return fail(`/${data.slug} is already used by another page.`);
    return fail(error.message);
  }
  revalidateContent(data.slug);
  return { success: true, data: { id: created.id } };
}

export async function setContentStatus(
  id: number,
  status: 'publish' | 'draft'
): Promise<ActionResult<{ id: number }>> {
  const { adminClient } = await requireAdmin();
  const { data: existing } = await adminClient
    .from('content')
    .select('slug, published_at')
    .eq('id', id)
    .maybeSingle();
  if (!existing) return fail('That page no longer exists');

  // Un-publishing a draft keeps the original publication date so restoring it
  // does not bump the page back to the top of the news feed.
  const publishedAt =
    status === 'publish'
      ? (existing.published_at ?? new Date().toISOString())
      : existing.published_at;

  const { error } = await adminClient
    .from('content')
    .update({ status, published_at: publishedAt })
    .eq('id', id);
  if (error) return fail(error.message);
  revalidateContent(existing.slug);
  return { success: true, data: { id } };
}

export async function deleteContent(id: number): Promise<ActionResult> {
  const { adminClient } = await requireAdmin();
  const { data: existing } = await adminClient
    .from('content')
    .select('slug')
    .eq('id', id)
    .maybeSingle();
  if (!existing) return fail('That page no longer exists');

  const { error } = await adminClient.from('content').delete().eq('id', id);
  if (error) return fail(error.message);
  revalidateContent(existing.slug);
  return { success: true };
}

/**
 * Copy a page as a draft. The copy always lands on the draft side and gets a
 * distinct slug, so duplicating can never produce two live pages at one URL.
 */
export async function duplicateContent(id: number): Promise<ActionResult<{ id: number }>> {
  const { adminClient } = await requireAdmin();
  const { data: source } = await adminClient.from('content').select('*').eq('id', id).maybeSingle();
  if (!source) return fail('That page no longer exists');

  const baseSlug = `${source.slug}-copy`;
  let slug = baseSlug;
  for (let attempt = 2; attempt <= 25; attempt += 1) {
    const conflict = await assertSlugAvailable(slug, adminClient);
    if (!conflict) break;
    if (attempt === 25) return fail('Could not find a free slug for the copy');
    slug = `${baseSlug}-${attempt}`;
  }

  const { data: created, error } = await adminClient
    .from('content')
    .insert({
      title: `${source.title} (copy)`,
      slug,
      body: source.body,
      excerpt: source.excerpt,
      type: source.type,
      status: 'draft',
      published_at: null,
      featured_image: source.featured_image,
      metadata: source.metadata,
    })
    .select('id')
    .single();
  if (error) return fail(error.message);
  revalidateContent(slug);
  return { success: true, data: { id: created.id } };
}

export async function getContentRevisions(
  contentId: number,
  limit = 20
): Promise<ActionResult<{ revisions: ContentRevision[] }>> {
  const { adminClient } = await requireAdmin();
  const { data, error } = await adminClient
    .from('content_revisions')
    .select('*')
    .eq('content_id', contentId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(Math.min(50, Math.max(1, limit)));
  if (error) return fail(error.message);
  return { success: true, data: { revisions: data ?? [] } };
}

/**
 * Roll a page back to a previous revision by writing that revision's body back
 * through `saveContent`, so the restore itself is recorded as a new revision —
 * the history is append-only and a mistaken restore is itself undoable.
 */
export async function restoreContentRevision(
  contentId: number,
  revisionId: number
): Promise<ActionResult<{ id: number }>> {
  const { adminClient } = await requireAdmin();
  const { data: revision, error } = await adminClient
    .from('content_revisions')
    .select('*')
    .eq('id', revisionId)
    .eq('content_id', contentId)
    .maybeSingle();
  if (error) return fail(error.message);
  if (!revision) return fail('That revision no longer exists');

  // The hero travels with the revision. The column arrives via migration
  // `20260930000000`; the optional read keeps pre-migration rows compiling,
  // and they restore exactly as before (no hero).
  const hero = (revision as ContentRevision & { featured_image?: string | null }).featured_image;

  // So does the publish date, and for the same reason. `saveContent` re-stamps
  // `published_at = now()` whenever a published page is written without one, so
  // restoring a March revision of a post re-dated it to today and jumped it to
  // the top of `/news` — the exact reordering `setContentStatus` was written to
  // prevent three functions away in this same file. The column arrives via
  // `20260930120000`; a revision older than that restores its content and takes
  // the re-dating, as it did before.
  const publishedAt =
    (revision as ContentRevision & { published_at?: string | null }).published_at ?? null;

  return saveContent({
    id: contentId,
    title: revision.title ?? 'Untitled',
    slug: revision.slug ?? 'untitled',
    excerpt: revision.excerpt,
    type: (revision.type as ContentType) ?? 'page',
    status: (revision.status as 'publish' | 'draft') ?? 'draft',
    body: revision.body ?? '',
    featuredImage: hero ?? null,
    publishedAt,
    metadata: (revision.metadata as Record<string, string>) ?? {},
  });
}

/**
 * Raster allowlist, identical to the product uploader.
 *
 * SVG is excluded deliberately: it is active content that executes on the
 * storage origin under the site's own CSP, so an uploaded SVG is stored XSS
 * against every page that references it. There is no sanitiser here that would
 * make an SVG safe to serve from the site's own domain.
 */
const CONTENT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
const CONTENT_IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_CONTENT_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Upload an image for a CMS page or block and return its public URL.
 *
 * Without this the editor can only reference an image the admin already has a
 * URL for, which makes "add a photo of today's rally" a three-step detour
 * through an external host. The file lands in the same public `media` bucket
 * the rest of the site uses, so it is served by the existing CDN path and
 * needs no new bucket policy.
 *
 * The URL is absolute. That matters: `sanitizeWPContent` rewrites relative
 * `src` values to a Storage URL on every render, so storing a relative path
 * would make the stored document non-idempotent and produce a fresh revision on
 * every load.
 */
export async function uploadContentImage(formData: FormData): Promise<{ url: string }> {
  const file = formData.get('file');
  if (!(file instanceof File)) throw new Error('No file provided');
  if (!CONTENT_IMAGE_TYPES.includes(file.type as (typeof CONTENT_IMAGE_TYPES)[number])) {
    throw new Error('Image must be JPEG, PNG, WebP or GIF. SVG is not allowed.');
  }
  if (file.size > MAX_CONTENT_IMAGE_BYTES) throw new Error('Image must be 5MB or smaller');

  const { adminClient } = await requireAdmin();

  // A random component, not a timestamp: two organizers uploading
  // "rally.jpg" in the same second must not collide, and a content-hash-free
  // timestamp path is exactly how that happens.
  const ext = CONTENT_IMAGE_EXT[file.type] ?? 'png';
  const base =
    (file.name.replace(/\.[^.]+$/, '') || 'image')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'image';
  const unique = crypto.randomUUID().slice(0, 8);
  const path = `content/${base}-${unique}.${ext}`;

  const { error } = await adminClient.storage
    .from('media')
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw new Error(error.message);

  return { url: getStorageUrl(path) };
}

/** Remove an orphaned upload, e.g. when the author replaces an image they just added. */
export async function deleteContentImage(
  url: string
): Promise<{ deleted: boolean; retained?: 'referenced' | 'foreign' }> {
  const { adminClient } = await requireAdmin();
  const base = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;
  if (!url.startsWith(base)) {
    // Only ever delete from our own bucket, and only by full path match.
    return { deleted: false, retained: 'foreign' };
  }
  const path = url.slice(base.length);
  if (!path.startsWith('content/') || path.includes('..')) {
    return { deleted: false, retained: 'foreign' };
  }

  /**
   * Check every reference before removing, including revisions.
   *
   * This action was previously an unconditional `storage.remove()`, which made
   * a careless click a data-loss event: the same upload is routinely used twice
   * — two blocks on one page, a hero image reused across pages, a revision that
   * would then restore an image that no longer exists. The author's own unsaved
   * edits are not visible here either, so the check can only be conservative.
   *
   * The failure direction is deliberate. Declining to delete leaves an orphaned
   * file, which is garbage; deleting a file still in use is broken content on a
   * live page. Revisions are checked as well as live rows, because a restore
   * that points at a deleted object is worse than a restore that 404s.
   */
  const [bodyRefs, imageRefs, revisionRefs] = await Promise.all([
    adminClient.from('content').select('id').like('body', `%${path}%`).limit(1),
    adminClient.from('content').select('id').eq('featured_image', url).limit(1),
    adminClient.from('content_revisions').select('id').like('body', `%${path}%`).limit(1),
  ]);
  const referenced =
    (bodyRefs.data?.length ?? 0) > 0 ||
    (imageRefs.data?.length ?? 0) > 0 ||
    (revisionRefs.data?.length ?? 0) > 0;
  if (referenced) return { deleted: false, retained: 'referenced' };

  const { error } = await adminClient.storage.from('media').remove([path]);
  if (error) return { deleted: false };
  return { deleted: true };
}
