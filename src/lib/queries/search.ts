import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

/**
 * Full-text search over the weighted tsvector columns + ranking RPCs added in
 * migration 20260825130000_fts_search.sql.
 *
 * The RPCs are invoked through the UNTYPED supabase-js surface because
 * generated Database types lag behind fresh migrations until
 * `bun run types:generate` runs against the deployed schema. Results are
 * mapped back into explicit shapes here so callers stay fully typed.
 *
 * Every helper degrades gracefully: if the RPC is missing (e.g. a preview
 * environment whose migrations have not applied yet) callers fall back to
 * the legacy ILIKE path instead of erroring the page.
 */

const MAX_QUERY_LENGTH = 100;

export interface RankedContentRow {
  id: number;
  title: string;
  slug: string;
  type: string | null;
  created_at: string | null;
}

/** Trim + cap user input before it reaches tsquery or ilike patterns. */
export function normalizeSearchQuery(raw: string): string {
  return raw.trim().slice(0, MAX_QUERY_LENGTH);
}

function asUntyped(client: SupabaseClient<Database>): SupabaseClient {
  return client as unknown as SupabaseClient;
}

interface RpcResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export async function searchContentRanked(
  client: SupabaseClient<Database>,
  query: string,
  maxRows = 10
): Promise<RankedContentRow[] | null> {
  const { data, error } = (await asUntyped(client).rpc('search_content', {
    search_query: query,
    max_rows: maxRows,
  })) as unknown as RpcResult<RankedContentRow>;

  if (error) return null;
  return Array.isArray(data) ? data : [];
}
