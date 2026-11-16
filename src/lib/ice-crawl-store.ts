import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type {
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
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

export async function getIceCrawlSource(store: IceCrawlStore, id: string) {
  const { data, error } = await store
    .from('ice_crawl_sources')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`crawl source failed: ${error.message}`);
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
  const { data, error } = await store
    .from('ice_crawl_sources')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(`crawl source insert failed: ${error.message}`);
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
  let inserted = 0;
  for (let offset = 0; offset < rows.length; offset += 50) {
    const chunk = rows.slice(offset, offset + 50);
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

export async function getPublishedSourceReports(
  store: IceCrawlStore,
  limit = 12
) {
  const { data, error } = await store
    .from('ice_source_reports')
    .select(
      'id, source_name, source_url, source_title, source_published_at, source_retrieved_at, title, text_content, city, state_code, kind, extraction_method, published_at'
    )
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`source reports failed: ${error.message}`);
  return (data ?? []) as IceSourceReport[];
}
