import type { GalleryPhoto } from '@/lib/queries/content-client';

/**
 * The shape the gallery UI actually consumes.
 *
 * `GalleryPhoto` in `@/lib/queries/content-client` is the database row with its
 * `storage_path` resolved to a public URL, and it carries fields only the query
 * layer needs. Server components re-map rows before handing photos to client
 * components, and those remapped objects do not include `storage_path` — which is
 * why they need their own type rather than being forced to fabricate a field
 * they have no use for.
 */
export type GalleryPhotoView = Omit<GalleryPhoto, 'storage_path' | 'sort_order' | 'label'>;
