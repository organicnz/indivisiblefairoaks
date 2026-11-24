import type { AdminClient } from './shared';

/**
 * The durable ledger behind direct-email idempotency.
 *
 * A row is written *before* Resend is called. If the process dies between the
 * provider accepting the message and the ledger settling, the row is still
 * there, and a retry with the same key can call Resend again: Resend's
 * `Idempotency-Key` cache returns the original message id instead of sending a
 * second copy. An accepted row is never called again.
 *
 * The table is deliberately outside the generated browser-safe client types,
 * like `admin_audit_outbox`. Only server actions and the service role touch it.
 */
export const DIRECT_EMAIL_SEND_TABLE = 'crm_direct_email_sends';

/**
 * How long a `pending` row is treated as owned by the request that created it.
 * Resend calls time out after ten seconds; two minutes leaves room for the
 * post-provider writes before another request may reclaim the attempt.
 */
export const DIRECT_EMAIL_SEND_LEASE_MS = 2 * 60_000;

/**
 * Resend keeps an idempotency key for 24 hours. A retry after that window can
 * no longer be deduplicated by the provider, so an attempt whose acceptance is
 * uncertain must not be replayed. A definite 4xx rejection is safe: no message
 * was accepted for the expired key to duplicate.
 */
export const DIRECT_EMAIL_PROVIDER_IDEMPOTENCY_MS = 24 * 60 * 60_000;

export type DirectEmailSendStatus = 'pending' | 'accepted' | 'failed';

export interface DirectEmailSendRow {
  id: string;
  idempotency_key: string;
  contact_id: string | null;
  actor_user_id: string;
  recipient_email: string;
  subject: string;
  message: string;
  status: DirectEmailSendStatus;
  provider_id: string | null;
  provider_status: number | null;
  error: string | null;
  attempts: number;
  started_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewDirectEmailSend {
  idempotency_key: string;
  contact_id: string;
  actor_user_id: string;
  recipient_email: string;
  subject: string;
  message: string;
}

type LedgerError = { message: string; code?: string } | null;
type LedgerResponse<T> = { data: T | null; error: LedgerError };

/** The narrow slice of the Supabase builder these helpers use. */
interface LedgerQuery {
  eq(column: string, value: string): LedgerQuery;
  select(columns?: string): LedgerQuery;
  maybeSingle(): Promise<LedgerResponse<DirectEmailSendRow>>;
  single(): Promise<LedgerResponse<DirectEmailSendRow>>;
}

interface LedgerTable {
  select(columns: string): LedgerQuery;
  insert(values: Record<string, unknown>): LedgerQuery;
  update(values: Record<string, unknown>): LedgerQuery;
}

interface LedgerClient {
  from(table: string): LedgerTable;
}

function ledger(client: AdminClient): LedgerClient {
  return client as unknown as LedgerClient;
}

export function readDirectEmailSend(
  client: AdminClient,
  key: string
): Promise<LedgerResponse<DirectEmailSendRow>> {
  return ledger(client)
    .from(DIRECT_EMAIL_SEND_TABLE)
    .select('*')
    .eq('idempotency_key', key)
    .maybeSingle();
}

export function createDirectEmailSend(
  client: AdminClient,
  send: NewDirectEmailSend
): Promise<LedgerResponse<DirectEmailSendRow>> {
  return ledger(client)
    .from(DIRECT_EMAIL_SEND_TABLE)
    .insert({
      ...send,
      status: 'pending',
      provider_id: null,
      provider_status: null,
      error: null,
      attempts: 1,
      started_at: new Date().toISOString(),
      accepted_at: null,
    })
    .select('*')
    .single();
}

export function isDirectEmailSendStale(row: DirectEmailSendRow, now = Date.now()): boolean {
  const startedAt = Date.parse(row.started_at);
  return !Number.isFinite(startedAt) || now - startedAt >= DIRECT_EMAIL_SEND_LEASE_MS;
}

export function isDirectEmailSendRetrySafe(row: DirectEmailSendRow, now = Date.now()): boolean {
  if (row.status === 'accepted') return false;
  const startedAt = Date.parse(row.started_at);
  if (!Number.isFinite(startedAt)) return false;
  if (now - startedAt < DIRECT_EMAIL_PROVIDER_IDEMPOTENCY_MS) return true;
  return (
    row.status === 'failed' &&
    row.provider_status !== null &&
    row.provider_status >= 400 &&
    row.provider_status < 500
  );
}

/**
 * Take ownership of a failed or stale-pending row.
 *
 * The update is conditional on the exact status and `started_at` that were
 * read, so two requests cannot both reclaim the same attempt. The loser gets no
 * row and reports that the send is still in progress.
 */
export function claimDirectEmailSend(
  client: AdminClient,
  row: DirectEmailSendRow
): Promise<LedgerResponse<DirectEmailSendRow>> {
  return ledger(client)
    .from(DIRECT_EMAIL_SEND_TABLE)
    .update({
      status: 'pending',
      started_at: new Date().toISOString(),
      attempts: Number.isFinite(row.attempts) ? row.attempts + 1 : 1,
      provider_id: null,
      provider_status: null,
      accepted_at: null,
      error: null,
    })
    .eq('idempotency_key', row.idempotency_key)
    .eq('status', row.status)
    .eq('started_at', row.started_at)
    .select('*')
    .maybeSingle();
}

/**
 * Retry a transient ledger write. The provider has already accepted the email
 * by the time `markDirectEmailSendAccepted` runs, so a single pooler blip must
 * not leave the row pending without at least trying again. Three attempts is
 * the same budget the admin audit writer uses.
 */
async function withLedgerRetry<T>(
  write: () => Promise<LedgerResponse<T>>
): Promise<LedgerResponse<T>> {
  let result = await write();
  for (let attempt = 0; attempt < 2 && result.error; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 75 : 200));
    result = await write();
  }
  return result;
}

export function markDirectEmailSendAccepted(
  client: AdminClient,
  key: string,
  providerId: string,
  providerStatus: number,
  acceptedAt: string
): Promise<LedgerResponse<DirectEmailSendRow>> {
  return withLedgerRetry(() =>
    ledger(client)
      .from(DIRECT_EMAIL_SEND_TABLE)
      .update({
        status: 'accepted',
        provider_id: providerId || null,
        provider_status: providerStatus,
        accepted_at: acceptedAt,
        error: null,
      })
      .eq('idempotency_key', key)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle()
  );
}

export function markDirectEmailSendFailed(
  client: AdminClient,
  key: string,
  providerStatus: number,
  error: string
): Promise<LedgerResponse<DirectEmailSendRow>> {
  return withLedgerRetry(() =>
    ledger(client)
      .from(DIRECT_EMAIL_SEND_TABLE)
      .update({
        status: 'failed',
        provider_status: providerStatus,
        error: error.slice(0, 2000),
      })
      .eq('idempotency_key', key)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle()
  );
}
