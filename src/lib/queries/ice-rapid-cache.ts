import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RapidFeedBase } from '@/components/ice-alerts/rapid-types';
import { env } from '@/lib/env';

/**
 * The public feed is assembled from upstream sources that this project does not
 * control. Keeping the last successful, already-sanitized projection in Supabase
 * gives every serverless instance a complete fallback even when the upstream
 * XML/RSS endpoints are slow or unavailable.
 */
const CACHE_ID = 'current';

type CacheRow = {
  payload: unknown;
  fetched_at: string;
};

type IceRapidCacheDatabase = {
  public: {
    Tables: {
      ice_rapid_feed_cache: {
        Row: {
          id: string;
          payload: RapidFeedBase;
          generated_at: string;
          fetched_at: string;
        };
        Insert: {
          id: string;
          payload: RapidFeedBase;
          generated_at: string;
          fetched_at?: string;
        };
        Update: Partial<{
          payload: RapidFeedBase;
          generated_at: string;
          fetched_at: string;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type IceRapidCacheStore = SupabaseClient<IceRapidCacheDatabase>;

export type PersistedRapidFeed = {
  feed: RapidFeedBase;
  fetchedAt: string;
};

let loggedReadFailure = false;
let loggedWriteFailure = false;

function cacheStore(): IceRapidCacheStore | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;

  return createClient<IceRapidCacheDatabase>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isFeedBase(value: unknown): value is RapidFeedBase {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.generatedAt === 'string' &&
    Array.isArray(candidate.alerts) &&
    Array.isArray(candidate.officialReleases) &&
    typeof candidate.community === 'object' &&
    candidate.community !== null &&
    typeof candidate.official === 'object' &&
    candidate.official !== null
  );
}

/**
 * Read the most recent successful feed if it is still within `maxAgeMs`.
 * A missing table (before the migration reaches an environment), missing
 * service credentials, or a transient Supabase error all degrade to `null`:
 * the live fetch path still owns the request.
 */
export async function readPersistedRapidFeed(
  maxAgeMs: number
): Promise<PersistedRapidFeed | null> {
  const store = cacheStore();
  if (!store) return null;

  try {
    const { data, error } = await store
      .from('ice_rapid_feed_cache')
      .select('payload, fetched_at')
      .eq('id', CACHE_ID)
      .abortSignal(AbortSignal.timeout(2_500))
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    const row = data as CacheRow;
    const fetchedMs = Date.parse(row.fetched_at);
    if (!Number.isFinite(fetchedMs)) return null;
    if (Date.now() - fetchedMs > maxAgeMs) return null;
    if (!isFeedBase(row.payload)) return null;

    return { feed: row.payload, fetchedAt: row.fetched_at };
  } catch (error) {
    if (!loggedReadFailure) {
      loggedReadFailure = true;
      console.warn(
        'Unable to read the ICE rapid feed cache; continuing with live sources',
        error instanceof Error ? error.message : 'unknown error'
      );
    }
    return null;
  }
}

/**
 * Persist a successful feed for cold instances and upstream outages. Cache
 * writes are deliberately best-effort: a Supabase failure must never turn a
 * good feed response into an error.
 */
export async function persistRapidFeed(feed: RapidFeedBase): Promise<void> {
  const store = cacheStore();
  if (!store) return;

  try {
    const { error } = await store.from('ice_rapid_feed_cache').upsert(
      {
        id: CACHE_ID,
        payload: feed,
        generated_at: feed.generatedAt,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    ).abortSignal(AbortSignal.timeout(2_500));
    if (error) throw new Error(error.message);
  } catch (error) {
    if (!loggedWriteFailure) {
      loggedWriteFailure = true;
      console.warn(
        'Unable to persist the ICE rapid feed cache; the live response is unaffected',
        error instanceof Error ? error.message : 'unknown error'
      );
    }
  }
}
