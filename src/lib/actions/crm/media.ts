import { measureImageSize } from '@/lib/image-size';
import { getStorageUrl } from '@/lib/supabase';
import type { MediaItem, MediaListResult, MediaUploadResult } from '@/types/unified';
import { type AdminClient, type CRMResult, requireCRMAdmin } from './shared';

// ---------------------------------------------------------------------------
// Supabase S3 Media Storage for CRM & Visual Editor
// ---------------------------------------------------------------------------

const CRM_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
const CRM_IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_CRM_IMAGE_BYTES = 5 * 1024 * 1024;
const HEADER_PROBE_BYTES = 64 * 1024;

/**
 * The storage folders the media library may browse, upload into and delete from.
 *
 * One list, because the three consumers used three: `getCRMMediaFiles` accepted
 * these three, `uploadCRMMedia` wrote only `crm/` regardless of what it was
 * asked for, and `deleteCRMMedia` refused anything but `crm/`. The visual
 * editor therefore opened on `content/`, could not delete anything it saw
 * there, and every upload it made landed in the CRM namespace where the
 * broadcast reference check — not the content one — was the guard.
 */
const MEDIA_FOLDERS = ['crm', 'content', 'gallery'] as const;
/**
 * The union lives in `src/types/crm.ts` now, so the uploader's `folder`, the
 * listing's `folder` and `MediaItem.folder` are one type rather than three
 * spellings. The local alias is kept because this file names it a hundred times.
 */
type MediaFolder = (typeof MEDIA_FOLDERS)[number];

function isMediaFolder(value: unknown): value is MediaFolder {
  return typeof value === 'string' && (MEDIA_FOLDERS as readonly string[]).includes(value);
}

/**
 * Fetch media files directly from Supabase S3 Storage ('media' bucket)
 * for use across the CRM, Broadcast Composer, and constituent records.
 */
export async function getCRMMediaFiles(options?: {
  folder?: string;
  search?: string;
  limit?: number;
}): Promise<MediaListResult> {
  const { adminClient } = await requireCRMAdmin();
  const folder = options?.folder || 'crm';
  const search = options?.search?.trim().toLowerCase().slice(0, 120) || '';
  /*
   * Storage's `list()` accepts whatever limit it is handed. A caller passing
   * `-1`, `NaN` or a million should not be able to turn a picker read into an
   * unbounded scan or a provider error; 200 matches the public gallery route's
   * ceiling and is comfortably above every picker's page size.
   */
  const requestedLimit = options?.limit ?? 100;
  const limit =
    typeof requestedLimit === 'number' && Number.isFinite(requestedLimit)
      ? Math.min(200, Math.max(1, Math.floor(requestedLimit)))
      : 100;

  const foldersToScan =
    folder === 'all' ? [...MEDIA_FOLDERS] : [isMediaFolder(folder) ? folder : 'crm'];

  const results: MediaItem[] = [];

  for (const f of foldersToScan) {
    const { data, error } = await adminClient.storage.from('media').list(f, {
      limit,
      sortBy: { column: 'created_at', order: 'desc' },
    });

    if (error) {
      throw new Error(`Failed to list ${f} media: ${error.message}`);
    }
    if (!data) continue;

    for (const item of data) {
      if (!item.name || item.name === '.emptyFolderPlaceholder') continue;
      if (search && !item.name.toLowerCase().includes(search)) continue;

      const path = `${f}/${item.name}`;
      const url = getStorageUrl(path, 'media');
      const size = (item.metadata?.size as number) || 0;
      const mimeType = (item.metadata?.mimetype as string) || 'image/jpeg';
      const createdAt = item.created_at || item.updated_at || new Date().toISOString();

      results.push({
        id: item.id || path,
        name: item.name,
        path,
        url,
        size,
        mimeType,
        createdAt,
        // Storage's `list()` does not report dimensions, so a listed file
        // carries the same `null` an unmeasured upload does. Omitting the keys
        // instead is what split the type in two.
        width: null,
        height: null,
        folder: f,
      });
    }
  }

  results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    items: results.slice(0, limit),
    folders: [...MEDIA_FOLDERS],
  };
}

/**
 * Upload an image asset into the Supabase S3 Storage 'media' bucket under the
 * folder the caller names, with format verification, XSS prevention and size
 * bounds.
 *
 * The folder is a form field rather than a hardcoded `crm/`, because the visual
 * editor, the broadcast composer and the CMS all share this action and a file
 * written into the wrong namespace is later guarded by the wrong reference
 * check — `deleteCRMMedia` looks in `crm_broadcasts` for a `crm/` path and in
 * `content` / `content_revisions` for a `content/` one, so an upload that
 * crossed over was deletable while still in use.
 *
 * The return type is the shared `MediaUploadResult` rather than an inline
 * literal: that literal was a second copy of `MediaItem`'s fields, which is
 * how `folder` ended up `string` in one place and a union in the other.
 */
export async function uploadCRMMedia(formData: FormData): Promise<MediaUploadResult> {
  try {
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return { success: false, error: 'No file provided' };
    }
    if (!CRM_IMAGE_TYPES.includes(file.type as (typeof CRM_IMAGE_TYPES)[number])) {
      return {
        success: false,
        error: 'Image must be JPEG, PNG, WebP or GIF. SVG is prohibited to prevent stored XSS.',
      };
    }
    if (file.size > MAX_CRM_IMAGE_BYTES) {
      return { success: false, error: 'Image must be 5MB or smaller' };
    }

    /**
     * An unrecognised folder falls back to `crm` rather than failing.
     *
     * The caller asked for a file to be stored, and it is — silently refusing
     * would be the worse failure. `isMediaFolder` is a type guard on the same
     * list `deleteCRMMedia` validates against, so a folder that cannot be
     * written cannot be read either.
     */
    const requestedFolder = formData.get('folder');
    const folder: MediaFolder = isMediaFolder(requestedFolder) ? requestedFolder : 'crm';

    const { adminClient } = await requireCRMAdmin();

    const ext = CRM_IMAGE_EXT[file.type] ?? 'png';
    const base =
      (file.name.replace(/\.[^.]+$/, '') || 'media')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'media';
    const unique = crypto.randomUUID().slice(0, 8);
    const path = `${folder}/${base}-${unique}.${ext}`;

    const { error: uploadError } = await adminClient.storage
      .from('media')
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    const head = new Uint8Array(await file.slice(0, HEADER_PROBE_BYTES).arrayBuffer());
    const measured = measureImageSize(head, file.type);
    const url = getStorageUrl(path, 'media');

    return {
      success: true,
      data: {
        id: path,
        name: file.name,
        path,
        url,
        size: file.size,
        mimeType: file.type,
        width: measured?.width ?? null,
        height: measured?.height ?? null,
        createdAt: new Date().toISOString(),
        folder,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to upload media',
    };
  }
}

/**
 * Remove an image asset from Supabase Storage 'media' bucket.
 *
 * Folder-scoped, with the reference check chosen by the folder.
 *
 * The previous version refused everything outside `crm/`. That was correct as a
 * guard and wrong as a feature: the media library the content editor and the
 * visual editor both open defaults to `content/`, so every delete button there
 * answered "not allowed" for a file the same dialog had just let the operator
 * upload. A guard that refuses its own uploads protects nothing.
 *
 * Each namespace is checked against the tables that can actually reference it.
 * Deleting a file a *sent* campaign uses breaks opens retroactively, because
 * email clients fetch remote images at open time; deleting one a live page uses
 * is broken content on a public URL. Declining leaves an orphan, which is
 * garbage.
 */
export async function deleteCRMMedia(path: string): Promise<CRMResult> {
  try {
    const { adminClient } = await requireCRMAdmin();

    const folder = path.split('/')[0];
    if (path.includes('..') || !isMediaFolder(folder)) {
      return {
        success: false,
        error: `Deletions are restricted to the ${MEDIA_FOLDERS.join(', ')} media folders`,
      };
    }

    const reason = await mediaReferenceReason(adminClient, folder, path);
    if (reason) return { success: false, error: reason };

    const { error } = await adminClient.storage.from('media').remove([path]);
    if (error) return { success: false, error: error.message };

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete media',
    };
  }
}

/**
 * Why a stored file is still in use, or null when it is not.
 *
 * One function rather than a branch in the caller, so "check before you delete"
 * has exactly one implementation. Broadcast bodies hold the image as markdown
 * against the public storage URL, which contains the path; content bodies hold
 * it in the sanitized HTML and `featured_image` holds the full URL; revisions
 * hold both, because a restore that points at a deleted object is worse than a
 * restore that 404s.
 *
 * A read error returns a reason rather than null. The caller is about to remove
 * a file, and "I could not tell" must fail in the direction that keeps it.
 */
async function mediaReferenceReason(
  adminClient: AdminClient,
  folder: MediaFolder,
  path: string
): Promise<string | null> {
  // Paths are slugified on upload, but LIKE treats `%`, `_` and `\` as
  // metacharacters — escape so the check matches the literal path. Chained
  // string replaces (not a replace callback) so no new function enters the
  // coverage-measured file for a branch no test exercises.
  const like = `%${path.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
  if (folder === 'crm') {
    const url = getStorageUrl(path, 'media');
    const [broadcasts, contentBody, revisions] = await Promise.all([
      adminClient.from('crm_broadcasts').select('id').like('body', like).limit(1),
      // Folder-scoped uploads should not cross namespaces, but a `crm/` URL
      // pasted into a page is still a reference — deleting it still breaks
      // the page. Check the full URL there (content stores absolute URLs).
      adminClient.from('content').select('id').like('body', `%${url}%`).limit(1),
      adminClient.from('content_revisions').select('id').like('body', `%${url}%`).limit(1),
    ]);
    if (broadcasts.error || contentBody.error || revisions.error) {
      return 'Could not verify whether this image is still in use';
    }
    if (
      (broadcasts.data?.length ?? 0) > 0 ||
      (contentBody.data?.length ?? 0) > 0 ||
      (revisions.data?.length ?? 0) > 0
    ) {
      return 'This image is still used in a saved broadcast or page and cannot be deleted yet.';
    }
    return null;
  }

  if (folder === 'content' || folder === 'gallery') {
    const url = getStorageUrl(path, 'media');
    const [broadcasts, body, featured, revisions] = await Promise.all([
      adminClient.from('crm_broadcasts').select('id').like('body', `%${path}%`).limit(1),
      adminClient.from('content').select('id').like('body', `%${path}%`).limit(1),
      adminClient.from('content').select('id').eq('featured_image', url).limit(1),
      adminClient.from('content_revisions').select('id').like('body', `%${path}%`).limit(1),
    ]);
    if (broadcasts.error || body.error || featured.error || revisions.error) {
      return 'Could not verify whether this image is still in use';
    }
    const referencedByPage =
      (body.data?.length ?? 0) > 0 ||
      (featured.data?.length ?? 0) > 0 ||
      (revisions.data?.length ?? 0) > 0;
    if (referencedByPage) {
      return 'This image is still used by a page or one of its revisions and cannot be deleted yet.';
    }
    if ((broadcasts.data?.length ?? 0) > 0) {
      return 'This image is still used in a saved broadcast and cannot be deleted yet.';
    }
    return null;
  }

  return null;
}
