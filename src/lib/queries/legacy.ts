import type { SupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import { env } from '@/lib/env';
import { createPublicClient } from '@/lib/supabase-server';

/**
 * Public reads of the legacy archive go through security-definer views created
 * in 20261113120000_legacy_content_archive.sql. The base tables are admin/service
 * role only, so private storage paths never reach anon through PostgREST.
 *
 * The import is intentionally separate from this query layer: until the
 * migration has been applied and an import has run, these queries return empty
 * arrays and every page keeps its current fallback links.
 */
export interface LegacyPageRow {
  id: string;
  source_path: string;
  source_url: string;
  title: string;
  page_kind: string;
  destination: string;
  summary: string;
  body_text: string;
  captured_at: string | null;
  sort_order: number;
}

export interface LegacyAssetRow {
  id: string;
  source_page_path: string;
  source_url: string;
  kind: string;
  drive_id: string | null;
  youtube_id: string | null;
  filename: string | null;
  public_path: string | null;
  public_url: string | null;
  external_url: string | null;
  byte_size: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  caption: string | null;
  rights: string;
  status: string;
  sort_order: number;
}

export interface LegacyPageLinkRow {
  id: string;
  page_id: string;
  asset_id: string | null;
  href: string;
  label: string;
  kind: string;
  is_external: boolean;
  sort_order: number;
}

export interface LegacyDocumentRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  source_page_path: string;
  file_path: string | null;
  public_url: string | null;
  external_url: string | null;
  mime_type: string | null;
  byte_size: number | null;
  rights: string;
  published_at: string | null;
  sort_order: number;
  drive_id: string | null;
  youtube_id: string | null;
}

export interface LegacyArchive {
  pages: LegacyPageRow[];
  assets: LegacyAssetRow[];
  links: LegacyPageLinkRow[];
  documents: LegacyDocumentRow[];
}

function publicClient(): SupabaseClient {
  // The generated Database type predates these views; the row interfaces above
  // narrow every field the UI uses.
  return createPublicClient() as unknown as SupabaseClient;
}

function storagePublicUrl(bucket: string, objectPath: string | null): string | null {
  if (!objectPath) return null;
  const encoded = objectPath.split('/').map(encodeURIComponent).join('/');
  return `${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${encoded}`;
}

export function legacyAssetUrl(
  asset: Pick<LegacyAssetRow, 'public_url' | 'public_path' | 'external_url' | 'source_url'>
): string | null {
  return (
    asset.public_url ??
    storagePublicUrl('legacy-documents', asset.public_path) ??
    asset.external_url ??
    asset.source_url ??
    null
  );
}

export function legacyDocumentUrl(
  document: Pick<LegacyDocumentRow, 'public_url' | 'file_path' | 'external_url'>,
): string | null {
  return (
    document.public_url ??
    storagePublicUrl('legacy-documents', document.file_path) ??
    document.external_url
  );
}

export function legacyDocumentForDriveId(
  documents: LegacyDocumentRow[],
  driveId: string,
): LegacyDocumentRow | null {
  return documents.find((document) => document.drive_id === driveId) ?? null;
}

export async function getLegacyArchive(): Promise<LegacyArchive> {
  'use cache';
  cacheLife('hours');
  cacheTag('legacy-archive');

  try {
    const supabase = publicClient();
    const [pagesResult, assetsResult, linksResult, documentsResult] = await Promise.all([
      supabase
        .from('legacy_public_pages')
        .select(
          'id, source_path, source_url, title, page_kind, destination, summary, body_text, captured_at, sort_order'
        )
        .order('sort_order', { ascending: true }),
      supabase
        .from('legacy_public_assets')
        .select(
          'id, source_page_path, source_url, kind, drive_id, youtube_id, filename, public_path, public_url, external_url, byte_size, mime_type, width, height, alt_text, caption, rights, status, sort_order'
        )
        .order('sort_order', { ascending: true }),
      supabase
        .from('legacy_public_page_links')
        .select('id, page_id, asset_id, href, label, kind, is_external, sort_order')
        .order('sort_order', { ascending: true }),
      supabase
        .from('legacy_public_documents')
        .select(
          'id, slug, title, category, description, source_page_path, file_path, public_url, external_url, mime_type, byte_size, rights, published_at, sort_order, drive_id, youtube_id'
        )
        .order('sort_order', { ascending: true }),
    ]);

    return {
      pages: (pagesResult.data ?? []) as LegacyPageRow[],
      assets: (assetsResult.data ?? []) as LegacyAssetRow[],
      links: (linksResult.data ?? []) as LegacyPageLinkRow[],
      documents: (documentsResult.data ?? []) as LegacyDocumentRow[],
    };
  } catch {
    return { pages: [], assets: [], links: [], documents: [] };
  }
}

export async function getLegacyDocuments(category?: string): Promise<LegacyDocumentRow[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('legacy-archive');

  try {
    const supabase = publicClient();
    let query = supabase
      .from('legacy_public_documents')
      .select(
        'id, slug, title, category, description, source_page_path, file_path, public_url, external_url, mime_type, byte_size, rights, published_at, sort_order, drive_id, youtube_id'
      )
      .order('sort_order', { ascending: true });
    if (category) query = query.eq('category', category);
    const { data } = await query;
    return (data ?? []) as LegacyDocumentRow[];
  } catch {
    return [];
  }
}
