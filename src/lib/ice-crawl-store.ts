import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  canonicalizeDiscoveryUrl,
  dedupeDiscoveryCandidates,
  discoveryStoryKey,
} from '@/lib/ice-crawl-discovery';
import { env } from '@/lib/env';
import {
  normalizeIceSourceReportQuery,
  type IceSourceReportFilters,
} from '@/lib/ice-source-report-search';
import type {
  IceCrawlDiscovery,
  IceCrawlDiscoveryStatus,
  IceCrawlSource,
  IceCrawlSourceStatus,
  IceSourceExtractionMethod,
  IceSourceReport,
  IceSourceReportKind,
} from '@/lib/ice-crawl-types';

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
        Update: Partial<IceSourceReportInput>;
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
    .upsert(
      { ...page, source_id: sourceId },
      { onConflict: 'source_id,url' }
    )
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

export async function insertIceSourceReports(
  store: IceCrawlStore,
  rows: IceSourceReportInput[]
) {
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
    .select('id', { count: 'exact', head: true });

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
    .select(
      'id, source_name, source_url, source_title, source_published_at, source_retrieved_at, title, text_content, city, state_code, kind, extraction_method, published_at'
    )
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
  return (data ?? []) as IceSourceReport[];
}
