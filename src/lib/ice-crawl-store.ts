import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import {
  canonicalizeDiscoveryUrl,
  dedupeDiscoveryCandidates,
  discoveryStoryKey,
} from '@/lib/ice-crawl-discovery';
import type {
  IceCrawlDiscovery,
  IceCrawlDiscoveryStatus,
  IceCrawlSource,
  IceCrawlSourceStatus,
  IceSourceExtractionMethod,
  IceSourceReport,
  IceSourceReportKind,
} from '@/lib/ice-crawl-types';
import {
  type IceSourceReportFilters,
  normalizeIceSourceReportQuery,
} from '@/lib/ice-source-report-search';

export type IceCrawlPageRow = {
  id: string;
  source_id: string;
  url: string;
  final_url: string | null;
  http_status: number | null;
  content_type: string | null;
  content_hash: string | null;
  title: string | null;
  text_content: string | null;
  error: string | null;
  extraction_method: IceSourceExtractionMethod | null;
  report_count: number;
  fetched_at: string;
  created_at: string;
};

export type IceCrawlPageInput = {
  url: string;
  final_url?: string | null;
  http_status?: number | null;
  content_type?: string | null;
  content_hash?: string | null;
  title?: string | null;
  text_content?: string | null;
  error?: string | null;
  extraction_method?: IceSourceExtractionMethod | null;
  report_count?: number;
  fetched_at?: string;
};

export type IceCityPoint = {
  city: string;
  state: string;
  stateCode: string;
  lat: number;
  lng: number;
  count: number;
};

export type IceSourceReportLocationRow = {
  id: string;
  title: string;
  text_content: string;
  city: string | null;
  state_code: string | null;
};

export type IceSourceReportInput = {
  source_id: string;
  page_id: string | null;
  source_name: string;
  source_url: string;
  source_title: string | null;
  source_published_at: string | null;
  source_retrieved_at: string;
  title: string;
  text_content: string;
  city: string | null;
  state_code: string | null;
  kind: IceSourceReportKind;
  extraction_method: IceSourceExtractionMethod;
  dedupe_key: string;
  published_at?: string;
};

export type IceSourceReportRefinementRow = Pick<
  IceSourceReport,
  'id' | 'source_url' | 'source_title' | 'title' | 'text_content' | 'refined_text' | 'refined_at'
>;

export type IceSourceReportSummary = Pick<
  IceSourceReport,
  | 'id'
  | 'title'
  | 'source_name'
  | 'source_url'
  | 'source_published_at'
  | 'source_retrieved_at'
  | 'kind'
  | 'extraction_method'
  | 'published_at'
  | 'city'
  | 'state_code'
>;

type IceCrawlDatabase = {
  public: {
    Tables: {
      ice_crawl_sources: {
        Row: IceCrawlSource;
        Insert: {
          id?: string;
          url: string;
          label: string;
          enabled?: boolean;
          max_pages?: number;
          rights_confirmed_at: string;
        };
        Update: Partial<
          Pick<
            IceCrawlSource,
            | 'enabled'
            | 'max_pages'
            | 'last_crawled_at'
            | 'last_status'
            | 'last_error'
            | 'last_page_count'
            | 'last_report_count'
          >
        >;
        Relationships: [];
      };
      ice_crawl_discoveries: {
        Row: IceCrawlDiscovery;
        Insert: {
          url: string;
          title: string;
          publisher?: string | null;
          published_at?: string | null;
          discovery_query: string;
          story_key?: string | null;
          status?: IceCrawlDiscoveryStatus;
          source_id?: string | null;
          reviewed_at?: string | null;
          review_note?: string | null;
        };
        Update: Partial<{
          status: IceCrawlDiscoveryStatus;
          source_id: string | null;
          reviewed_at: string | null;
          review_note: string | null;
        }>;
        Relationships: [];
      };
      ice_crawl_pages: {
        Row: IceCrawlPageRow;
        Insert: IceCrawlPageInput & { source_id: string };
        Update: Partial<IceCrawlPageInput> & {
          source_id?: string;
          report_count?: number;
        };
        Relationships: [];
      };
      ice_source_reports: {
        Row: IceSourceReport;
        Insert: IceSourceReportInput;
        Update: Partial<IceSourceReportInput> & {
          refined_text?: string | null;
          refined_at?: string | null;
        };
        Relationships: [];
      };
      ice_heatmap_releases: {
        Row: { id: string; period_end: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      ice_heatmap_cities: {
        Row: {
          release_id: string;
          city: string;
          state: string;
          state_code: string;
          lat: number;
          lng: number;
          arrest_count: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      ice_crawl_frontier: {
        Row: { source_id: string; url: string; depth: number; queued_at: string };
        Insert: { source_id: string; url: string; depth?: number; queued_at?: string };
        Update: Partial<{ depth: number }>;
        Relationships: [];
      };
      ice_crawl_page_images: {
        Row: {
          id: string;
          source_id: string;
          page_id: string;
          image_url: string;
          storage_path: string;
          mime_type: 'image/webp';
          width: number | null;
          height: number | null;
          bytes: number | null;
          dedupe_key: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_id: string;
          page_id: string;
          image_url: string;
          storage_path: string;
          mime_type: 'image/webp';
          width?: number | null;
          height?: number | null;
          bytes?: number | null;
          dedupe_key: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      insert_ice_crawl_discoveries: {
        Args: {
          p_rows: Array<{
            url: string;
            title: string;
            publisher: string | null;
            published_at: string | null;
            discovery_query: string;
            story_key: string;
          }>;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type IceCrawlStore = SupabaseClient<IceCrawlDatabase>;

export function getIceCrawlStore(): IceCrawlStore | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;

  return createClient<IceCrawlDatabase>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function listIceCrawlSources(store: IceCrawlStore) {
  const { data, error } = await store
    .from('ice_crawl_sources')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`crawl sources failed: ${error.message}`);
  return data ?? [];
}

export async function listIceCrawlDiscoveries(
  store: IceCrawlStore,
  status: IceCrawlDiscoveryStatus = 'pending',
  limit = 30
) {
  const { data, error } = await store
    .from('ice_crawl_discoveries')
    .select('*')
    .eq('status', status)
    .order('discovered_at', { ascending: false })
    .limit(Math.min(Math.max(1, limit), 100));
  if (error) throw new Error(`crawl discoveries failed: ${error.message}`);
  return (data ?? []) as IceCrawlDiscovery[];
}

export async function getIceCrawlDiscovery(store: IceCrawlStore, id: string) {
  const { data, error } = await store
    .from('ice_crawl_discoveries')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`crawl discovery failed: ${error.message}`);
  return data as IceCrawlDiscovery | null;
}

export async function insertIceCrawlDiscoveries(
  store: IceCrawlStore,
  rows: Array<{
    url: string;
    title: string;
    publisher: string | null;
    published_at: string | null;
    discovery_query: string;
  }>
) {
  if (rows.length === 0) return 0;

  // Canonicalize and dedupe inside the store as well as in the discovery
  // providers. This protects the queue if a caller passes a batch assembled by
  // an older route, a retry, or two overlapping scans.
  const candidates = rows.flatMap((row) => {
    const url = canonicalizeDiscoveryUrl(row.url);
    const title = row.title.trim().slice(0, 300);
    if (!url || !title) return [];

    const parsedPublishedAt = row.published_at ? Date.parse(row.published_at) : NaN;
    const publishedAt = Number.isNaN(parsedPublishedAt)
      ? null
      : new Date(parsedPublishedAt).toISOString();
    const publisher = row.publisher?.trim().slice(0, 120) || null;
    return [
      {
        url,
        title,
        publisher,
        published_at: publishedAt,
        discovery_query: row.discovery_query.trim().slice(0, 120) || 'discovery',
        story_key: discoveryStoryKey(title, publisher, publishedAt),
      },
    ];
  });
  const unique = dedupeDiscoveryCandidates(candidates).map((candidate) => ({
    ...candidate,
    story_key: discoveryStoryKey(candidate.title, candidate.publisher, candidate.published_at),
  }));
  if (unique.length === 0) return 0;

  let inserted = 0;
  for (let offset = 0; offset < unique.length; offset += 50) {
    const chunk = unique.slice(offset, offset + 50);
    // The SQL function uses `on conflict do nothing` without a target, so a
    // URL duplicate OR a story-key duplicate is ignored atomically.
    const { data, error } = await store.rpc('insert_ice_crawl_discoveries', {
      p_rows: chunk,
    });
    if (error) throw new Error(`crawl discovery insert failed: ${error.message}`);
    inserted += Number(data ?? 0);
  }
  return inserted;
}

export async function reviewIceCrawlDiscovery(
  store: IceCrawlStore,
  id: string,
  row: {
    status: Exclude<IceCrawlDiscoveryStatus, 'pending'>;
    source_id?: string | null;
    reviewed_at: string;
    review_note: string | null;
  }
) {
  const { data, error } = await store
    .from('ice_crawl_discoveries')
    .update(row)
    .eq('id', id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`crawl discovery review failed: ${error.message}`);
  return data as IceCrawlDiscovery | null;
}

export async function getIceCrawlSource(store: IceCrawlStore, id: string) {
  const { data, error } = await store
    .from('ice_crawl_sources')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`crawl source failed: ${error.message}`);
  return data;
}

export async function getIceCrawlSourceByUrl(store: IceCrawlStore, url: string) {
  const { data, error } = await store
    .from('ice_crawl_sources')
    .select('*')
    .eq('url', url)
    .maybeSingle();
  if (error) throw new Error(`crawl source lookup failed: ${error.message}`);
  return data;
}

export async function insertIceCrawlSource(
  store: IceCrawlStore,
  row: {
    url: string;
    label: string;
    max_pages: number;
    rights_confirmed_at: string;
  }
) {
  const url = canonicalizeDiscoveryUrl(row.url);
  if (!url) {
    throw new Error('crawl source URL is not a canonical public https URL.');
  }

  const { data, error } = await store
    .from('ice_crawl_sources')
    .insert({ ...row, url })
    .select('*')
    .single();
  if (error) {
    const wrapped = new Error(`crawl source insert failed: ${error.message}`) as Error & {
      code?: string;
    };
    wrapped.code = error.code;
    throw wrapped;
  }
  return data;
}

export async function updateIceCrawlSource(
  store: IceCrawlStore,
  id: string,
  row: {
    enabled?: boolean;
    max_pages?: number;
    last_crawled_at?: string;
    last_status?: IceCrawlSourceStatus;
    last_error?: string | null;
    last_page_count?: number;
    last_report_count?: number;
  }
) {
  const { data, error } = await store
    .from('ice_crawl_sources')
    .update(row)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`crawl source update failed: ${error.message}`);
  return data;
}

export async function upsertIceCrawlPage(
  store: IceCrawlStore,
  sourceId: string,
  page: IceCrawlPageInput
) {
  const { data, error } = await store
    .from('ice_crawl_pages')
    .upsert({ ...page, source_id: sourceId }, { onConflict: 'source_id,url' })
    .select('*')
    .single();
  if (error) throw new Error(`crawl page upsert failed: ${error.message}`);
  return data;
}

export async function updateIceCrawlPageReportCount(
  store: IceCrawlStore,
  id: string,
  reportCount: number
) {
  const { error } = await store
    .from('ice_crawl_pages')
    .update({ report_count: reportCount })
    .eq('id', id);
  if (error) throw new Error(`crawl page update failed: ${error.message}`);
}

export async function insertIceSourceReports(store: IceCrawlStore, rows: IceSourceReportInput[]) {
  const unique = new Map<string, IceSourceReportInput>();
  for (const row of rows) {
    if (row.dedupe_key && !unique.has(row.dedupe_key)) unique.set(row.dedupe_key, row);
  }
  const uniqueRows = [...unique.values()];
  let inserted = 0;
  for (let offset = 0; offset < uniqueRows.length; offset += 50) {
    const chunk = uniqueRows.slice(offset, offset + 50);
    if (chunk.length === 0) continue;
    const { data, error } = await store
      .from('ice_source_reports')
      .upsert(chunk, { onConflict: 'dedupe_key', ignoreDuplicates: true })
      .select('id');
    if (error) throw new Error(`source report insert failed: ${error.message}`);
    inserted += data?.length ?? 0;
  }
  return inserted;
}

/**
 * Load the persisted crawl queue for a source. Budgeted ticks resume here so a
 * source larger than one function-time budget is walked to its page limit over
 * several ticks instead of re-fetching its seed on every run.
 */
export async function listIceCrawlFrontier(
  store: IceCrawlStore,
  sourceId: string,
  limit = 400
): Promise<Array<{ url: string; depth: number }>> {
  const { data, error } = await store
    .from('ice_crawl_frontier')
    .select('url, depth')
    .eq('source_id', sourceId)
    .order('queued_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`crawl frontier read failed: ${error.message}`);
  return data ?? [];
}

export async function saveIceCrawlFrontier(
  store: IceCrawlStore,
  sourceId: string,
  items: ReadonlyArray<{ url: string; depth: number }>
) {
  if (items.length === 0) return 0;
  const unique = new Map<string, { source_id: string; url: string; depth: number }>();
  for (const item of items) {
    if (!unique.has(item.url)) {
      unique.set(item.url, { source_id: sourceId, url: item.url, depth: item.depth });
    }
  }
  const rows = [...unique.values()];
  let saved = 0;
  for (let offset = 0; offset < rows.length; offset += 200) {
    const chunk = rows.slice(offset, offset + 200);
    const { error } = await store
      .from('ice_crawl_frontier')
      .upsert(chunk, { onConflict: 'source_id,url', ignoreDuplicates: true });
    if (error) throw new Error(`crawl frontier write failed: ${error.message}`);
    saved += chunk.length;
  }
  return saved;
}

export async function deleteIceCrawlFrontier(
  store: IceCrawlStore,
  sourceId: string,
  urls: readonly string[]
) {
  for (let offset = 0; offset < urls.length; offset += 200) {
    const chunk = urls.slice(offset, offset + 200);
    if (chunk.length === 0) continue;
    const { error } = await store
      .from('ice_crawl_frontier')
      .delete()
      .eq('source_id', sourceId)
      .in('url', chunk);
    if (error) throw new Error(`crawl frontier cleanup failed: ${error.message}`);
  }
}

export type IceCrawlPageImageInput = {
  source_id: string;
  page_id: string;
  image_url: string;
  storage_path: string;
  mime_type: 'image/webp';
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  dedupe_key: string;
};

export async function insertIceCrawlPageImages(
  store: IceCrawlStore,
  rows: readonly IceCrawlPageImageInput[]
) {
  if (rows.length === 0) return 0;
  const { data, error } = await store
    .from('ice_crawl_page_images')
    .upsert([...rows], { onConflict: 'dedupe_key', ignoreDuplicates: true })
    .select('id');
  if (error) throw new Error(`crawl image insert failed: ${error.message}`);
  return data?.length ?? 0;
}

function sourceReportSearchTerm(filters?: IceSourceReportFilters) {
  const query = normalizeIceSourceReportQuery(filters?.query);
  if (!query) return '';
  return query;
}

export async function listIceCityPoints(store: IceCrawlStore) {
  const { data: release, error: releaseError } = await store
    .from('ice_heatmap_releases')
    .select('id')
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (releaseError) throw new Error(`city release lookup failed: ${releaseError.message}`);
  if (!release) return [] as IceCityPoint[];

  const points: IceCityPoint[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await store
      .from('ice_heatmap_cities')
      .select('city, state, state_code, lat, lng, arrest_count')
      .eq('release_id', release.id)
      .order('state_code', { ascending: true })
      .order('city', { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`city point lookup failed: ${error.message}`);

    const page = data ?? [];
    points.push(
      ...page.map((row) => ({
        city: row.city,
        state: row.state,
        stateCode: row.state_code,
        lat: row.lat,
        lng: row.lng,
        count: row.arrest_count,
      }))
    );
    if (page.length < 1000) break;
  }

  return points;
}

export async function listSourceReportsForLocationAudit(
  store: IceCrawlStore,
  limit = 1000,
  offset = 0
) {
  const from = Math.max(0, offset);
  const { data, error } = await store
    .from('ice_source_reports')
    .select('id, title, text_content, city, state_code')
    .order('id', { ascending: true })
    .range(from, from + Math.max(1, limit) - 1);
  if (error) throw new Error(`source location audit failed: ${error.message}`);
  return (data ?? []) as IceSourceReportLocationRow[];
}

export async function updateSourceReportLocations(
  store: IceCrawlStore,
  ids: string[],
  city: string | null,
  stateCode: string | null
) {
  const { data, error } = await store
    .from('ice_source_reports')
    .update({ city, state_code: stateCode })
    .in('id', ids)
    .select('id');
  if (error) throw new Error(`source location update failed: ${error.message}`);
  return data?.length ?? 0;
}

export async function getPublishedSourceReportCount(
  store: IceCrawlStore,
  filters?: IceSourceReportFilters
) {
  let query = store
    .from('ice_source_reports')
    .select('id', { count: 'exact', head: true })
    // The store uses the service-role key, so PostgREST does not apply the
    // anon RLS policy that hides future-dated rows. Every public read must
    // repeat that predicate or a scheduled report becomes visible early.
    .lte('published_at', new Date().toISOString());

  if (filters?.kind && filters.kind !== 'all') {
    query = query.eq('kind', filters.kind);
  }
  if (filters?.stateCode) {
    query = query.eq('state_code', filters.stateCode);
  }
  if (filters?.city) {
    // The locator returns the stored city spelling, but a hand-written URL may
    // use different casing. Normalized city input cannot contain wildcard
    // characters, so ILIKE is safe here and keeps selected places case-safe.
    query = query.ilike('city', filters.city);
  }

  const search = sourceReportSearchTerm(filters);
  if (search) {
    query = query.or(
      `title.ilike.%${search}%,text_content.ilike.%${search}%,source_name.ilike.%${search}%,city.ilike.%${search}%`
    );
  }

  const { count, error } = await query;
  if (error) throw new Error(`source report count failed: ${error.message}`);
  return count ?? 0;
}

export async function getPublishedSourceReportCitySummary(
  store: IceCrawlStore,
  city: string,
  stateCode: string,
  limit = 6
) {
  const filters: IceSourceReportFilters = {
    query: '',
    kind: 'all',
    stateCode,
    city,
  };
  const [total, recentResult] = await Promise.all([
    getPublishedSourceReportCount(store, filters),
    store
      .from('ice_source_reports')
      .select(
        'id, title, source_name, source_url, source_published_at, source_retrieved_at, kind, extraction_method, published_at, city, state_code'
      )
      .lte('published_at', new Date().toISOString())
      .eq('state_code', stateCode)
      .ilike('city', city)
      .order('published_at', { ascending: false })
      .limit(Math.min(Math.max(1, limit), 20)),
  ]);

  if (recentResult.error) {
    throw new Error(`source report city summary failed: ${recentResult.error.message}`);
  }

  return {
    total,
    recent: (recentResult.data ?? []) as unknown as IceSourceReportSummary[],
  };
}

export async function getSourceReportForRefinement(
  store: IceCrawlStore,
  id: string
): Promise<IceSourceReportRefinementRow | null> {
  const { data, error } = await store
    .from('ice_source_reports')
    .select('id, source_url, source_title, title, text_content, refined_text, refined_at')
    .eq('id', id)
    .lte('published_at', new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error(`source report refinement read failed: ${error.message}`);
  return (data as IceSourceReportRefinementRow | null) ?? null;
}

export async function saveSourceReportRefinement(
  store: IceCrawlStore,
  id: string,
  text: string,
  refinedAt: string
): Promise<boolean> {
  const { data, error } = await store
    .from('ice_source_reports')
    .update({ refined_text: text, refined_at: refinedAt })
    .eq('id', id)
    .select('id');
  if (error) throw new Error(`source report refinement write failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

function toPublicSourceReport(row: IceSourceReport): IceSourceReport {
  // Select `*` so the archive remains readable between an app deploy and the
  // reading-panel migration. The mapper keeps internal crawl fields out of the
  // public projection and turns absent new columns into nulls.
  return {
    id: row.id,
    source_name: row.source_name,
    source_url: row.source_url,
    source_title: row.source_title,
    source_published_at: row.source_published_at,
    source_retrieved_at: row.source_retrieved_at,
    title: row.title,
    text_content: row.text_content,
    refined_text: row.refined_text ?? null,
    refined_at: row.refined_at ?? null,
    city: row.city,
    state_code: row.state_code,
    kind: row.kind,
    extraction_method: row.extraction_method,
    published_at: row.published_at,
  };
}

export async function getPublishedSourceReports(
  store: IceCrawlStore,
  limit = 12,
  offset = 0,
  filters?: IceSourceReportFilters
) {
  const from = Math.max(0, offset);
  const to = from + Math.max(1, limit) - 1;
  let query = store
    .from('ice_source_reports')
    .select('*')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false });

  if (filters?.kind && filters.kind !== 'all') {
    query = query.eq('kind', filters.kind);
  }
  if (filters?.stateCode) {
    query = query.eq('state_code', filters.stateCode);
  }
  if (filters?.city) {
    query = query.ilike('city', filters.city);
  }

  const search = sourceReportSearchTerm(filters);
  if (search) {
    query = query.or(
      `title.ilike.%${search}%,text_content.ilike.%${search}%,source_name.ilike.%${search}%,city.ilike.%${search}%`
    );
  }

  const { data, error } = await query.range(from, to);
  if (error) throw new Error(`source reports failed: ${error.message}`);
  return ((data ?? []) as IceSourceReport[]).map(toPublicSourceReport);
}
