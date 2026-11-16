import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { RapidSurge } from '@/lib/ice-rapid-surges';

export type IceAlertPushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type IceAlertSubscriber = {
  id: string;
  email: string;
  email_normalized: string;
  state_code: string | null;
  city: string | null;
  email_opt_in: boolean;
  push_opt_in: boolean;
  push_subscription: IceAlertPushSubscription | null;
  confirm_token: string;
  confirm_token_expires_at: string | null;
  unsubscribe_token: string;
  confirmed_at: string | null;
  confirmation_sent_at: string | null;
  last_notified_at: string | null;
  last_surge_key: string | null;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type IceAlertSurgeEvent = {
  surge_key: string;
  scope: RapidSurge['scope'];
  label: string;
  state_code: string | null;
  city: string | null;
  active_count: number;
  window_minutes: number;
  detected_at: string;
  notified_at: string | null;
  delivery_count: number;
};

type SubscriberInsert = {
  email: string;
  state_code: string | null;
  city: string | null;
  email_opt_in: boolean;
  push_opt_in: boolean;
  push_subscription: IceAlertPushSubscription | null;
  confirm_token: string;
  confirm_token_expires_at: string | null;
  unsubscribe_token: string;
  confirmed_at: string | null;
  confirmation_sent_at: string | null;
};

type SubscriberUpdate = Partial<
  Omit<IceAlertSubscriber, 'id' | 'created_at'>
>;

type SurgeEventInsert = {
  surge_key: string;
  scope: RapidSurge['scope'];
  label: string;
  state_code: string | null;
  city: string | null;
  active_count: number;
  window_minutes: number;
  detected_at: string;
};

type IceAlertRateLimitRow = {
  scope: 'ip' | 'email' | 'endpoint' | 'global';
  key_hash: string;
  window_start: string;
  count: number;
};

export type IceAlertRateLimitResult = {
  allowed: boolean;
  retryAfterSec: number;
  limitedScope: 'ip' | 'email' | 'endpoint' | 'global' | null;
};

export type IceAlertRateLimitInput = {
  ipHash: string;
  emailHash: string;
  endpointHash: string | null;
  windowSeconds: number;
  ipLimit: number;
  emailLimit: number;
  endpointLimit: number;
  globalLimit: number;
};

type IceAlertDatabase = {
  public: {
    Tables: {
      ice_alert_subscribers: {
        Row: IceAlertSubscriber;
        Insert: SubscriberInsert;
        Update: SubscriberUpdate;
        Relationships: [];
      };
      ice_alert_surge_events: {
        Row: IceAlertSurgeEvent;
        Insert: SurgeEventInsert;
        Update: Partial<SurgeEventInsert & { notified_at: string; delivery_count: number }>;
        Relationships: [];
      };
      ice_alert_rate_limits: {
        Row: IceAlertRateLimitRow;
        Insert: IceAlertRateLimitRow;
        Update: Partial<IceAlertRateLimitRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      ice_alert_consume_rate_limits: {
        Args: {
          p_ip_hash: string;
          p_email_hash: string;
          p_endpoint_hash: string | null;
          p_window_seconds: number;
          p_ip_limit: number;
          p_email_limit: number;
          p_endpoint_limit: number;
          p_global_limit: number;
        };
        Returns: {
          allowed: boolean;
          retry_after_seconds: number;
          limited_scope: IceAlertRateLimitResult['limitedScope'];
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type IceAlertStore = SupabaseClient<IceAlertDatabase>;

export function getIceAlertStore(): IceAlertStore | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;

  return createClient<IceAlertDatabase>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function normalizeAlertEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function consumeIceAlertRateLimits(
  store: IceAlertStore,
  input: IceAlertRateLimitInput
): Promise<IceAlertRateLimitResult> {
  const { data, error } = await store.rpc('ice_alert_consume_rate_limits', {
    p_ip_hash: input.ipHash,
    p_email_hash: input.emailHash,
    p_endpoint_hash: input.endpointHash,
    p_window_seconds: input.windowSeconds,
    p_ip_limit: input.ipLimit,
    p_email_limit: input.emailLimit,
    p_endpoint_limit: input.endpointLimit,
    p_global_limit: input.globalLimit,
  });
  if (error) throw new Error(`rate limit lookup failed: ${error.message}`);

  const row = data?.[0];
  if (!row) throw new Error('rate limit lookup returned no row');
  return {
    allowed: row.allowed,
    retryAfterSec: row.retry_after_seconds,
    limitedScope: row.limited_scope,
  };
}

export async function findSubscriberByEmail(
  store: IceAlertStore,
  email: string
) {
  const { data, error } = await store
    .from('ice_alert_subscribers')
    .select('*')
    .eq('email_normalized', normalizeAlertEmail(email))
    .maybeSingle();
  if (error) throw new Error(`subscriber lookup failed: ${error.message}`);
  return data;
}

export async function findSubscriberById(
  store: IceAlertStore,
  id: string
) {
  const { data, error } = await store
    .from('ice_alert_subscribers')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`subscriber id lookup failed: ${error.message}`);
  return data;
}

export async function insertSubscriber(
  store: IceAlertStore,
  row: SubscriberInsert
) {
  const { data, error } = await store
    .from('ice_alert_subscribers')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(`subscriber insert failed: ${error.message}`);
  return data;
}

export async function updateSubscriber(
  store: IceAlertStore,
  id: string,
  patch: SubscriberUpdate
) {
  const { data, error } = await store
    .from('ice_alert_subscribers')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`subscriber update failed: ${error.message}`);
  return data;
}

export async function consumeIceAlertConfirmation(
  store: IceAlertStore,
  id: string,
  confirmToken: string,
  patch: SubscriberUpdate
): Promise<IceAlertSubscriber | null> {
  /*
   * The `.eq('confirm_token', …)` is the single-use boundary, not the read in
   * the route: two requests can both render the form, but only one UPDATE can
   * still match this token. Rotating to a fresh, never-emailed UUID also makes
   * a replay fail even when the subscriber is later unsubscribed or deleted.
   */
  const { data, error } = await store
    .from('ice_alert_subscribers')
    .update({
      ...patch,
      confirm_token: crypto.randomUUID(),
      confirm_token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('confirm_token', confirmToken)
    .gt('confirm_token_expires_at', new Date().toISOString())
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`subscriber confirmation failed: ${error.message}`);
  return data;
}

export async function findSubscriberByToken(
  store: IceAlertStore,
  column: 'confirm_token' | 'unsubscribe_token',
  token: string
) {
  const { data, error } = await store
    .from('ice_alert_subscribers')
    .select('*')
    .eq(column, token)
    .maybeSingle();
  if (error) throw new Error(`subscriber token lookup failed: ${error.message}`);
  return data;
}

export async function listExpiredPendingSubscribers(
  store: IceAlertStore,
  before: string,
  limit = 200
) {
  const { data, error } = await store
    .from('ice_alert_subscribers')
    .select('id')
    .is('confirmed_at', null)
    .is('unsubscribed_at', null)
    .lt('updated_at', before)
    .order('updated_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`pending subscriber retention query failed: ${error.message}`);
  return data ?? [];
}

export async function listExpiredUnsubscribedSubscribers(
  store: IceAlertStore,
  before: string,
  limit = 200
) {
  const { data, error } = await store
    .from('ice_alert_subscribers')
    .select('id')
    .not('unsubscribed_at', 'is', null)
    .lt('unsubscribed_at', before)
    .lt('updated_at', before)
    .order('unsubscribed_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`unsubscribed subscriber retention query failed: ${error.message}`);
  return data ?? [];
}

export async function deleteSubscribers(store: IceAlertStore, ids: string[]) {
  /*
   * Keep each PostgREST URL bounded. A purge can find 200 pending plus 200
   * unsubscribed rows in one run; sending all 400 UUIDs in one `in.(...)`
   * approaches proxy URL limits and turns a routine cleanup into a 414.
   */
  for (let index = 0; index < ids.length; index += 200) {
    const { error } = await store
      .from('ice_alert_subscribers')
      .delete()
      .in('id', ids.slice(index, index + 200));
    if (error) throw new Error(`subscriber retention delete failed: ${error.message}`);
  }
}

export async function listConfirmedSubscribers(
  store: IceAlertStore,
  limit = 500
) {
  const { data, error } = await store
    .from('ice_alert_subscribers')
    .select('*')
    .eq('email_opt_in', true)
    .not('confirmed_at', 'is', null)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`subscriber list failed: ${error.message}`);
  return data ?? [];
}

/**
 * Returns events that are new or still pending. Existing rows whose
 * `notified_at` is set are intentionally skipped.
 */
export async function claimSurgeEvents(
  store: IceAlertStore,
  surges: RapidSurge[]
) {
  if (surges.length === 0) return [];

  const keys = surges.map((surge) => surge.key);
  const { data: existing, error: existingError } = await store
    .from('ice_alert_surge_events')
    .select('*')
    .in('surge_key', keys);
  if (existingError) throw new Error(`surge lookup failed: ${existingError.message}`);

  const known = new Map((existing ?? []).map((row) => [row.surge_key, row]));
  const missing = surges.filter((surge) => !known.has(surge.key));

  if (missing.length > 0) {
    const rows: SurgeEventInsert[] = missing.map((surge) => ({
      surge_key: surge.key,
      scope: surge.scope,
      label: surge.label,
      state_code: surge.stateCode,
      city: surge.city,
      active_count: surge.count,
      window_minutes: surge.windowMinutes,
      detected_at: new Date().toISOString(),
    }));

    const { error } = await store
      .from('ice_alert_surge_events')
      .upsert(rows, { onConflict: 'surge_key', ignoreDuplicates: true });
    if (error) throw new Error(`surge insert failed: ${error.message}`);
  }

  const { data: pending, error: pendingError } = await store
    .from('ice_alert_surge_events')
    .select('*')
    .in('surge_key', keys)
    .is('notified_at', null);
  if (pendingError) throw new Error(`surge confirmation failed: ${pendingError.message}`);

  return pending ?? [];
}

export async function markSurgeNotified(
  store: IceAlertStore,
  key: string,
  deliveryCount: number
) {
  const { error } = await store
    .from('ice_alert_surge_events')
    .update({
      notified_at: new Date().toISOString(),
      delivery_count: deliveryCount,
    })
    .eq('surge_key', key);
  if (error) throw new Error(`surge mark failed: ${error.message}`);
}
