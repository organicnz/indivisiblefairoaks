'use server';

import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { getStorageUrl } from '@/lib/supabase';
import type {
  ContentMediaDeleteResult,
  ContentMediaInsert,
  ContentMediaListResult,
  ContentMediaPatch,
  ContentMediaRow,
  ContentMediaUploadResult,
} from '@/types/content-media';

const CONTENT_MEDIA_SCHEMA = z.object({
  content_id: z.number().int().positive(),
  name: z.string().min(1).max(255),
  path: z.string().min(1),
  url: z.string().url(),
  mime_type: z.string().min(1),
  size: z.number().int().positive(),
  width: z.number().int().nonnegative().nullable(),
  height: z.number().int().nonnegative().nullable(),
  alt_text: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  folder: z.string().default('content'),
  sort_order: z.number().int().nonnegative().default(0),
});

const CONTENT_MEDIA_PATCH_SCHEMA = z.object({
  alt_text: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  name: z.string().min(1).max(255).optional(),
  sort_order: z.number().int().nonnegative().optional(),
});

const PATCH_PARTIAL = CONTENT_MEDIA_PATCH_SCHEMA.partial();

const MAX_CONTENT_IMAGE_BYTES = 5 * 1024 * 1024;
const CONTENT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

function mediaUrl(path: string): string {
  return getStorageUrl(path, 'media');
}

/**
 * Refuse a media write against a content row that is not live.
 *
 * The `data === null` half is the one that matters, and it was missing: with a
 * `service_role` client (RLS bypassed) a draft row produces **no error**, just
 * an empty result — `maybeSingle()` resolves `{ data: null, error: null }`. The
 * previous version threw only on `error`, so every draft page sailed through a
 * gate whose entire job was to stop it. The hand-rolled mock in the old suite
 * answered the no-match case with an *error*, which is why a green suite and an
 * open gate coexisted.
 */
async function assertContentPublished(contentId: number): Promise<void> {
  const { adminClient } = await requireAdmin();
  const { data, error } = await adminClient
    .from('content')
    .select('id')
    .eq('id', contentId)
    .eq('status', 'publish')
    .lte('published_at', new Date().toISOString())
    .maybeSingle();
  if (error || data === null) throw new Error('Content row not found or unpublished');
}

/**
 * List media for a content page, ordered by sort_order then created_at.
 */
export async function getContentMedia(contentId: number): Promise<ContentMediaListResult> {
  const { adminClient } = await requireAdmin();
  await assertContentPublished(contentId);

  const { data, error } = await adminClient
    .from('content_media')
    .select('*')
    .eq('content_id', contentId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to list content media: ${error.message}`);
  return { items: (data as ContentMediaRow[]) ?? [], folders: ['content'] };
}

/**
 * Create a content_media row after uploading to the media bucket.
 * The upload happens client-side via CRMMediaLibraryModal; this only creates the row.
 */
export async function createContentMediaRow(
  input: ContentMediaInsert
): Promise<ContentMediaUploadResult> {
  const { adminClient } = await requireAdmin();
  const parsed = CONTENT_MEDIA_SCHEMA.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.message };
  await assertContentPublished(input.content_id);

  const { data, error } = await adminClient
    .from('content_media')
    .insert(parsed.data)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as ContentMediaRow };
}

/**
 * Update alt_text, caption, name, or sort_order for a content_media row.
 */
export async function updateContentMediaRow(
  id: string,
  patch: ContentMediaPatch
): Promise<ContentMediaUploadResult> {
  const { adminClient } = await requireAdmin();
  const parsed = PATCH_PARTIAL.safeParse(patch);
  if (!parsed.success) return { success: false, error: parsed.error.message };

  const { data: existing, error: fetchErr } = await adminClient
    .from('content_media')
    .select('content_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) return { success: false, error: fetchErr.message };
  if (!existing) return { success: false, error: 'Media row not found' };
  await assertContentPublished(existing.content_id);

  const { data, error } = await adminClient
    .from('content_media')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Media row vanished during update' };
  return { success: true, data: data as ContentMediaRow };
}

/**
 * Delete a content_media row, but only if no other content references the same storage path.
 * Mirrors the reference check in deleteContentImage (content.ts:607).
 */
export async function deleteContentMediaRow(
  id: string
): Promise<ContentMediaUploadResult<ContentMediaDeleteResult>> {
  const { adminClient } = await requireAdmin();

  const { data: target, error: fetchErr } = await adminClient
    .from('content_media')
    .select('path, content_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) return { success: false, error: fetchErr.message };
  if (!target) return { success: false, error: 'Media row not found' };
  await assertContentPublished(target.content_id);

  const path = target.path;

  // Check content.body, content.featured_image, content_revisions.body for this path
  const { adminClient: client } = await requireAdmin();
  const [bodyRef, heroRef, revRef] = await Promise.all([
    client.from('content').select('id').ilike('body', `%${path}%`).limit(1),
    client.from('content').select('id').eq('featured_image', mediaUrl(path)).limit(1),
    client.from('content_revisions').select('id').ilike('body', `%${path}%`).limit(1),
  ]);

  if (bodyRef.data && bodyRef.data.length > 0) {
    return {
      success: false,
      error: 'Path still referenced in content body',
      data: { deleted: false, retained: 'referenced' },
    };
  }
  if (heroRef.data && heroRef.data.length > 0) {
    return {
      success: false,
      error: 'Path still used as featured_image',
      data: { deleted: false, retained: 'referenced' },
    };
  }
  if (revRef.data && revRef.data.length > 0) {
    return {
      success: false,
      error: 'Path still referenced in content revisions',
      data: { deleted: false, retained: 'referenced' },
    };
  }

  // Delete from storage then DB
  const { error: storageErr } = await client.storage.from('media').remove([path]);
  if (storageErr) return { success: false, error: `Storage delete failed: ${storageErr.message}` };

  const { error: dbErr } = await client.from('content_media').delete().eq('id', id);
  if (dbErr) return { success: false, error: dbErr.message };

  return { success: true, data: { deleted: true } };
}

/**
 * Upload helper used by the overlay media panel.
 * Accepts a file, writes to media/content/…, measures dimensions, creates the row.
 */
export async function uploadAndCreateContentMedia(
  formData: FormData,
  contentId: number
): Promise<ContentMediaUploadResult> {
  const { adminClient } = await requireAdmin();
  await assertContentPublished(contentId);

  const file = formData.get('file') as File | null;
  if (!file) return { success: false, error: 'No file provided' };
  if (!CONTENT_IMAGE_TYPES.includes(file.type as (typeof CONTENT_IMAGE_TYPES)[number])) {
    return { success: false, error: 'Only JPEG, PNG, WebP, GIF are allowed' };
  }
  if (file.size > MAX_CONTENT_IMAGE_BYTES) {
    return { success: false, error: 'File exceeds 5 MB limit' };
  }

  // Measure dimensions from the first 64 KiB
  const head = await file.slice(0, 65536).arrayBuffer();
  const { measureImageSize } = await import('@/lib/image-size');
  const dims = measureImageSize(new Uint8Array(head), file.type);

  // Upload to media bucket under content/
  const ext = file.name.split('.').pop() ?? 'bin';
  const random = crypto.getRandomValues(new Uint8Array(4));
  const hex = Array.from(random)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const path = `content/${contentId}-${hex}.${ext}`;

  const { error: uploadErr } = await adminClient.storage.from('media').upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (uploadErr) return { success: false, error: `Upload failed: ${uploadErr.message}` };

  // Create the row
  const url = mediaUrl(path);
  const insert: ContentMediaInsert = {
    content_id: contentId,
    name: file.name,
    path,
    url,
    mime_type: file.type,
    size: file.size,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
    alt_text: null,
    caption: null,
    folder: 'content',
    sort_order: 0,
  };

  return createContentMediaRow(insert);
}
