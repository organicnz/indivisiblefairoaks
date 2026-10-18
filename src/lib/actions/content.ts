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
import { measureImageSize } from '@/lib/image-size';
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
  /**
   * The `updated_at` this edit was based on, as a precondition on the write.
   *
   * Two organizers on one page is the normal case for a volunteer group, and
   * without this the second save silently discards the first one's work —
   * last-write-wins with no signal at all, on the one surface whose entire
   * purpose is to look after written work.
   *
   * Three states, and they mean different things:
   *   - omitted — no precondition. A caller that does not know the row's
   *     version (a restore, a test, anything older) keeps the old behaviour
   *     rather than being locked out of saving.
   *   - a string — write only if the row still carries this timestamp.
   *   - `null`  — write only if the row's timestamp *is* null. Distinct from
   *     omitted: `expectedUpdatedAt: null` is a claim about the row, and
   *     conflating the two would silently disable the guard for any page whose
   *     timestamp happens to be unset.
   *
   * `.max(64)` rather than `.datetime()`: this value is only ever compared for
   * equality, so rejecting an unfamiliar-but-valid timestamp would block a
   * legitimate save to protect nothing.
   */
  expectedUpdatedAt: z.string().max(64).nullable().optional(),
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

export async function getContentBySlugForEdit(slug: string): Promise<ContentRow | null> {
  const { adminClient } = await requireAdmin();
  const { data, error } = await adminClient
    .from('content')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
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
  revalidateTag('posts', 'hours');
  if (slug) revalidateTag(`content-${slug}`, 'hours');
  // A slug change leaves the old tag orphaned, so invalidate it too.
  if (previousSlug && previousSlug !== slug) revalidateTag(`content-${previousSlug}`, 'hours');
  revalidatePath('/admin/content');
  revalidatePath('/news');
  revalidatePath('/sitemap.xml');
  revalidatePath('/search');
}

export async function saveContent(
  rawInput: ContentInput
): Promise<ActionResult<{ id: number; updatedAt: string | null }>> {
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

    // The precondition rides on the same UPDATE rather than on a separate
    // SELECT-then-UPDATE. Checking first would leave a window between the two
    // statements in which a colleague's save lands and is then overwritten —
    // the guard would pass and still lose their work.
    //
    // `.select(...)` is what makes the outcome observable: an UPDATE that
    // matches no rows returns `error: null` and `data: null`, which is
    // indistinguishable from success. Asking for the row back is the only way
    // to tell "wrote it" from "someone else moved it".
    let update = adminClient.from('content').update(row).eq('id', data.id);
    if (data.expectedUpdatedAt === null) {
      update = update.is('updated_at', null);
    } else if (typeof data.expectedUpdatedAt === 'string') {
      update = update.eq('updated_at', data.expectedUpdatedAt);
    }

    const { data: written, error } = await update.select('id, updated_at').maybeSingle();

    if (error) return fail(error.message);
    if (!written) {
      // Either a colleague saved in between, or the row was deleted outright.
      // Distinguishing the two costs a second round trip on a path that fires
      // once per conflict, and both are answered by the same action: reload,
      // see what is there, decide what to keep.
      return fail(
        'Someone else saved this page while you were editing it. Reload to see their version, then reapply your changes.'
      );
    }

    revalidateContent(data.slug, previous.slug);
    // The `updated_at` the trigger just wrote, not a timestamp generated here.
    // The editor has to learn the new value or its next autosave would conflict
    // with itself — which is the failure mode that would make this feature
    // unusable within two seconds of enabling it.
    return { success: true, data: { id: written.id, updatedAt: written.updated_at } };
  }

  const { data: created, error } = await adminClient
    .from('content')
    .insert(row)
    .select('id, updated_at')
    .single();
  if (error) {
    if (error.code === '23505') return fail(`/${data.slug} is already used by another page.`);
    return fail(error.message);
  }
  revalidateContent(data.slug);
  // `updated_at` is returned for the same reason as on update: the editor keeps
  // it as the precondition for its next write, so a freshly created page does
  // not conflict with itself on the first autosave.
  return { success: true, data: { id: created.id, updatedAt: created.updated_at } };
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

  // `.select()` is what makes the outcome observable. An UPDATE that matches no
  // rows returns `error: null`, so without asking for the row back this reports
  // success for a write that did nothing — a "Published" toast on a page that
  // someone else deleted between the read above and this statement. The CRM's
  // own `setCRMTaskStatus` and `deleteCRMTask` both ask for the row; this did
  // not, which is what made it an oversight rather than a decision.
  const { data: written, error } = await adminClient
    .from('content')
    .update({ status, published_at: publishedAt })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) return fail(error.message);
  if (!written) return fail('That page no longer exists');
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

  // The hero travels with the revision (migration `20260930000000`). Pre-migration
  // rows have `featured_image = NULL` and restore as before — no hero.
  const hero = revision.featured_image;

  // So does the publish date, and for the same reason. `saveContent` re-stamps
  // `published_at = now()` whenever a published page is written without one, so
  // restoring a March revision of a post re-dated it to today and jumped it to
  // the top of `/news` — the exact reordering `setContentStatus` was written to
  // prevent three functions away in this same file. A revision older than
  // migration `20260930120000` has `NULL` here and takes the re-dating, as it did
  // before.
  const publishedAt = revision.published_at ?? null;

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
 * How much of an uploaded file to read for its dimensions.
 *
 * 30 bytes covers a PNG's IHDR (24), a GIF's screen descriptor (10), and a
 * WebP's VP8X header (30). A JPEG has no fixed offset — its frame header sits
 * after an EXIF block that can run to tens of kilobytes — so this is a bound,
 * not a promise: a JPEG with a very large thumbnail is measured when the header
 * fits and returns `null` when it does not. That is the safe direction, since an
 * unmeasured image costs a layout shift and a wrong one also distorts.
 */
const HEADER_PROBE_BYTES = 64 * 1024;

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
/**
 * The result carries the image's intrinsic size as well as its URL.
 *
 * The dimensions are measured from the bytes that were just written to the
 * bucket, so they cannot be wrong — unlike a size the browser reports, which does
 * not exist on the paste path or the URL field, and unlike one the author types,
 * which nobody verifies. The editor writes them onto the block, and the
 * serializer emits them as `width` / `height`, which is what lets the browser
 * reserve the space before the bytes arrive. Without them every content image on
 * the site shifted layout as it loaded.
 *
 * `null` means "this header was not readable", not "zero", and the caller treats
 * it as unknown rather than rendering a zero-sized image.
 */
export async function uploadContentImage(formData: FormData): Promise<{
  url: string;
  width: number | null;
  height: number | null;
}> {
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

  // Measured after a successful write, and from a copy rather than the File: the
  // File has been consumed by the upload, and re-reading it would parse a
  // megabyte again for a header we only need the first few dozen bytes of.
  const head = new Uint8Array(await file.slice(0, HEADER_PROBE_BYTES).arrayBuffer());
  const measured = measureImageSize(head, file.type);

  return {
    url: getStorageUrl(path),
    width: measured?.width ?? null,
    height: measured?.height ?? null,
  };
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
