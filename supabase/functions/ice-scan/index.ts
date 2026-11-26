// @deno-types="npm:@supabase/supabase-js@^2.0.0"
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { isAttributedSourceDigest } from '../_shared/ice-digest.ts';
import { discoverNationwideCandidates } from '../_shared/ice-scan-discovery.ts';
import {
  fetchCrawlDocument,
  isPermanentFailure,
  mapWithConcurrency,
} from '../_shared/ice-scan-http.ts';
import { storeEvidenceImages } from '../_shared/ice-scan-images.ts';
import {
  classifyReportKind,
  discoveryRelevance,
  discoveryStoryKey,
  extractPublishedAt,
  extractTitle,
  readableText,
  shortError,
  type DiscoveryCandidate,
  type ProviderHealthMap,
} from '../_shared/ice-scan-logic.ts';

/**
 * `ice-scan` is the single scheduled scanner for the ICE case backend.
 *
 * Two modes share one function so they share one deployment, one auth check and
 * one observability surface:
 *
 * - `discover` queries the public national index and stores candidate
 *   headlines/links in `ice_crawl_discoveries`.
 * - `intake` drains a bounded batch of pending candidates: SSRF-safe fetch,
 *   deterministic relevance screen, independent AI screen/digest through the
 *   existing `ice-source-refine` function, then an attributed summary report
 *   and a compressed evidence image in the private `ice-evidence` bucket.
 *
 * Auth is deliberately in code, not `verify_jwt`: pg_cron presents a new
 * `sb_secret_` key on `apikey`, and those keys are not JWTs. See `inboundKeys`.
 *
 * Supabase is the source of truth. The function never writes to a second
 * store, every write is idempotent (`story_key`, `dedupe_key`, storage path),
 * and each phase takes a Postgres lease so overlapping cron ticks or a manual
 * watchdog cannot double-spend AI calls on the same candidate.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
// The legacy JWT is still the platform-injected key that the Supabase client
// uses to bypass RLS and that `ice-source-refine` (verify_jwt = true) accepts
// on its Authorization header.
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_URL = Deno.env.get('APP_URL') ?? 'https://indivisiblefairoaks.org';
const SCAN_BUDGET_MS = envInt('ICE_SCAN_BUDGET_MS', 100_000, 45_000, 140_000);
// Discovery intake is a draft factory by default. Turning this on submits new
// rows for publication, but the rights gate remains mandatory and independent.
const AUTO_PUBLISH = (Deno.env.get('ICE_DISCOVERY_AUTO_PUBLISH') ?? '').trim().toLowerCase() === 'true';
const PUBLICATION_STATUS = AUTO_PUBLISH ? 'published' : 'draft';
const INTAKE_DEFAULT = envInt('ICE_SCAN_INTAKE_LIMIT', 9, 1, 20);
const INTAKE_MAX = 20;
const CONCURRENCY = envInt('ICE_SCAN_CONCURRENCY', 3, 1, 6);
const RETRY_BACKOFF_MS = 10 * 60 * 1_000;
const MAX_ATTEMPTS = 6;
const LEASE_SECONDS = 180;
const DISCOVERY_BUDGET_MS = 45_000;
const IMAGE_BUDGET_MS = 12_000;
const AI_TIMEOUT_MS = 30_000;
const MIN_RELEVANT_TEXT = 80;
const MAX_MODEL_TEXT = 400_000;
const MAX_SUMMARY_CHARS = 5_000;
const DISCOVERY_SOURCE_URL = 'https://www.ice.gov/';
const DISCOVERY_SOURCE_LABEL = 'Nationwide web discovery';

const NO_STORE = { 'cache-control': 'no-store' };

function envInt(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(Deno.env.get(name));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...NO_STORE },
  });
}

function corsHeaders() {
  return {
    'access-control-allow-origin': APP_URL,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'origin',
  };
}

/** Constant-time comparison so an auth probe cannot learn the secret by timing. */
function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

/**
 * The gateway's `verify_jwt` cannot authenticate a new `sb_secret_` key: those
 * keys are not JWTs. This endpoint therefore runs with `verify_jwt = false`
 * and does its own exact, constant-time key check. `SUPABASE_SECRET_KEYS` is a
 * JSON dictionary injected by the platform; the legacy service-role JWT is
 * accepted too so an old caller cannot be locked out during key rotation.
 */
function inboundKeys() {
  const keys = new Set<string>();
  const plural = Deno.env.get('SUPABASE_SECRET_KEYS') ?? '';
  if (plural) {
    try {
      const parsed = JSON.parse(plural) as unknown;
      if (parsed && typeof parsed === 'object') {
        for (const value of Object.values(parsed as Record<string, unknown>)) {
          if (typeof value === 'string' && value.length > 0) keys.add(value);
        }
      }
    } catch {
      // A malformed platform value must not crash the scanner; the legacy key
      // below is still a valid fallback.
    }
  }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (legacy) keys.add(legacy);
  return [...keys];
}

const INBOUND_KEYS = inboundKeys();

function authorized(request: Request) {
  if (INBOUND_KEYS.length === 0) return false;
  const authorization = request.headers.get('authorization') ?? '';
  const apikey = request.headers.get('apikey') ?? '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const candidates = [apikey, bearer].filter((value) => value.length > 0);
  return INBOUND_KEYS.some((key) =>
    candidates.some((value) => timingSafeEqual(value, key)),
  );
}

function log(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ...data }));
}

type DiscoveryRow = {
  id: string;
  url: string;
  title: string;
  publisher: string | null;
  published_at: string | null;
  discovery_query: string;
  status: string;
  last_attempt_at: string | null;
  attempt_count: number | null;
};

type SourceRow = {
  id: string;
  url: string;
  label: string;
};

type OutcomeStatus = 'report' | 'duplicate' | 'rejected' | 'retry' | 'exhausted' | 'deferred';

type IntakeOutcome = {
  id: string;
  status: OutcomeStatus;
  reason: string;
  reportId?: string;
  images?: number;
  imageErrors?: string[];
  aiUnavailable?: boolean;
};

type PhaseResult = {
  skipped?: string;
  [key: string]: unknown;
};

function publisherName(discovery: DiscoveryRow, canonicalUrl: string) {
  if (discovery.publisher?.trim()) return discovery.publisher.trim().slice(0, 120);
  try {
    return new URL(canonicalUrl).hostname.replace(/^www\./, '').slice(0, 120);
  } catch {
    return 'Nationwide web discovery';
  }
}

async function claimLease(client: SupabaseClient<any>, job: string) {
  const { data, error } = await client.rpc('ice_scan_claim', {
    p_job: job,
    p_lease_seconds: LEASE_SECONDS,
  });
  if (error) throw new Error(`scan lease failed: ${error.message}`);
  return data === true;
}

async function releaseLease(client: SupabaseClient<any>, job: string) {
  try {
    await client.rpc('ice_scan_release', { p_job: job });
  } catch {
    // The lease expires on its own; a release error must not mask a run result.
  }
}

async function ensureDiscoverySource(client: SupabaseClient<any>): Promise<SourceRow> {
  const existing = await client
    .from('ice_crawl_sources')
    .select('id,url,label')
    .eq('url', DISCOVERY_SOURCE_URL)
    .maybeSingle();
  if (existing.error) throw new Error(`discovery source read failed: ${existing.error.message}`);
  if (existing.data) return existing.data as SourceRow;

  const inserted = await client
    .from('ice_crawl_sources')
    .insert({
      url: DISCOVERY_SOURCE_URL,
      label: DISCOVERY_SOURCE_LABEL,
      enabled: false,
      max_pages: 1,
      rights_confirmed_at: new Date().toISOString(),
    })
    .select('id,url,label')
    .single();
  if (!inserted.error) return inserted.data as SourceRow;

  // A second worker may have created it between the read and the insert.
  const retry = await client
    .from('ice_crawl_sources')
    .select('id,url,label')
    .eq('url', DISCOVERY_SOURCE_URL)
    .maybeSingle();
  if (retry.error || !retry.data) {
    throw new Error(`discovery source insert failed: ${inserted.error.message}`);
  }
  return retry.data as SourceRow;
}

/**
 * A provider cooldown is persisted with the previous completed run, not in an
 * isolate-local map. Edge workers are recycled, and a 403 would otherwise be
 * retried every fifteen minutes after every cold start.
 */
async function loadProviderHealth(client: SupabaseClient<any>): Promise<ProviderHealthMap> {
  const prior = await client
    .from('ice_scan_runs')
    .select('details')
    .in('job', ['discover', 'both'])
    .neq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(5);
  if (prior.error) {
    log('ice_scan_provider_health_read_failed', { error: prior.error.message });
    return {};
  }
  // A skipped or failed discovery run has no providerHealth field. Look past
  // it rather than resetting every publisher's cooldown on the next tick.
  for (const row of Array.isArray(prior.data) ? prior.data : []) {
    const value = row?.details?.providerHealth;
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length > 0
    ) {
      return value as ProviderHealthMap;
    }
  }
  return {};
}

async function runDiscovery(
  client: SupabaseClient<any>,
  deadline: number,
): Promise<PhaseResult> {
  const providerHealth = await loadProviderHealth(client);
  const discovery = await discoverNationwideCandidates({
    deadline: Math.min(deadline, Date.now() + DISCOVERY_BUDGET_MS),
    providerHealth,
  });
  const rows = discovery.candidates.map((candidate: DiscoveryCandidate) => ({
    url: candidate.url,
    title: candidate.title,
    publisher: candidate.publisher,
    published_at: candidate.published_at,
    discovery_query: candidate.discovery_query,
    story_key: discoveryStoryKey(candidate.title, candidate.publisher, candidate.published_at),
  }));

  let queued = 0;
  const errors = [...discovery.errors];
  for (let offset = 0; offset < rows.length; offset += 50) {
    const chunk = rows.slice(offset, offset + 50);
    const { data, error } = await client.rpc('insert_ice_crawl_discoveries', {
      p_rows: chunk,
    });
    if (error) {
      errors.push(`discovery insert: ${error.message}`);
      break;
    }
    queued += Number(data ?? 0);
  }

  log('ice_scan_discovery', {
    found: discovery.candidates.length,
    queued,
    providers: discovery.providers,
    fallbacks: discovery.fallbacks.map((fallback) => fallback.feed),
    warnings: discovery.warnings.length,
    errors: errors.length,
  });

  return {
    found: discovery.candidates.length,
    queued,
    providers: discovery.providers,
    fallbacks: discovery.fallbacks,
    warnings: discovery.warnings.slice(0, 20),
    providerHealth: discovery.providerHealth,
    errors: errors.slice(0, 20),
  };
}

async function listPending(client: SupabaseClient<any>, limit: number) {
  const { data, error } = await client
    .from('ice_crawl_discoveries')
    .select('*')
    .eq('status', 'pending')
    .lt('attempt_count', MAX_ATTEMPTS)
    .order('last_attempt_at', { ascending: true, nullsFirst: true })
    .order('discovered_at', { ascending: true })
    .limit(Math.min(100, limit * 4));
  if (error) throw new Error(`pending discovery read failed: ${error.message}`);

  const now = Date.now();
  return ((data ?? []) as DiscoveryRow[])
    .filter((row) => {
      // A transient publisher failure rotates the candidate to the back. It
      // must not be retried every five minutes forever while newer candidates
      // wait behind it.
      if (!row.last_attempt_at) return true;
      const attempted = Date.parse(row.last_attempt_at);
      return Number.isNaN(attempted) || now - attempted >= RETRY_BACKOFF_MS;
    })
    .slice(0, limit);
}

async function countPending(client: SupabaseClient<any>) {
  const { count, error } = await client
    .from('ice_crawl_discoveries')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lt('attempt_count', MAX_ATTEMPTS);
  if (error) return null;
  return count ?? 0;
}

async function recordDecision(
  client: SupabaseClient<any>,
  id: string,
  sourceId: string | null,
  status: 'approved' | 'rejected',
  note: string,
) {
  const { error } = await client
    .from('ice_crawl_discoveries')
    .update({
      status,
      source_id: sourceId,
      reviewed_at: new Date().toISOString(),
      review_note: note.slice(0, 500),
    })
    .eq('id', id)
    .eq('status', 'pending');
  if (error) throw new Error(`discovery decision failed: ${error.message}`);
}

/**
 * Record a transient failure and let Postgres decide whether the candidate has
 * exhausted its attempts. Keeping that decision in one SQL function means the
 * edge function and the Next fallback cannot disagree about when a poison row
 * stops consuming the queue.
 */
async function recordAttempt(client: SupabaseClient<any>, id: string, note: string) {
  const { data, error } = await client.rpc('record_ice_discovery_attempt', {
    p_id: id,
    p_note: note,
    p_max_attempts: MAX_ATTEMPTS,
  });
  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;
    const attemptCount = Number(row?.attempt_count ?? 0);
    return attemptCount >= MAX_ATTEMPTS ? 'exhausted' : 'retry';
  }

  // A project that has not applied the attempt RPC still gets the old
  // rotation behaviour: record the timestamp, leave the row pending.
  const fallback = await client
    .from('ice_crawl_discoveries')
    .update({
      review_note: note.slice(0, 500),
      reviewed_at: null,
      last_attempt_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending');
  if (fallback.error) throw new Error(`discovery attempt note failed: ${fallback.error.message}`);
  return 'retry';
}

async function refineWithAi(
  text: string,
  sourceUrl: string,
  sourceTitle: string,
): Promise<{ isReport: boolean; text: string } | null> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/ice-source-refine`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      text: text.slice(0, MAX_MODEL_TEXT),
      sourceUrl,
      sourceTitle: sourceTitle.slice(0, 300),
      mode: 'refine',
    }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    // A 400 is about this page; a 401/403/429/5xx is about the service. The
    // caller treats the first as a permanent candidate decision and the rest
    // as an outage that must not spend the candidate's retry budget.
    if (response.status === 400) {
      throw new Error('AI screen rejected the page (HTTP 400).');
    }
    throw new Error(`AI screen unavailable (HTTP ${response.status}).`);
  }
  const payload = (await response.json()) as { isReport?: unknown; text?: unknown };
  if (typeof payload.isReport !== 'boolean') {
    throw new Error('AI screen returned an unusable response.');
  }
  return {
    isReport: payload.isReport,
    text: typeof payload.text === 'string' ? payload.text : '',
  };
}

async function rotateDiscovery(client: SupabaseClient<any>, id: string, note: string) {
  const { error } = await client
    .from('ice_crawl_discoveries')
    .update({
      review_note: note.slice(0, 500),
      reviewed_at: null,
      last_attempt_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending');
  if (error) throw new Error(`discovery rotation failed: ${error.message}`);
}

async function processCandidate(
  client: SupabaseClient<any>,
  source: SourceRow,
  discovery: DiscoveryRow,
  deadline: number,
): Promise<IntakeOutcome> {
  const existing = await client
    .from('ice_source_reports')
    .select('id')
    .eq('source_url', discovery.url)
    .limit(1);
  if (existing.error) throw new Error(`report lookup failed: ${existing.error.message}`);
  if ((existing.data?.length ?? 0) > 0) {
    await recordDecision(
      client,
      discovery.id,
      source.id,
      'approved',
      'auto: duplicate report URL',
    );
    return {
      id: discovery.id,
      status: 'duplicate',
      reason: 'report already exists for canonical URL',
      reportId: existing.data?.[0]?.id,
    };
  }

  const page = await fetchCrawlDocument(discovery.url, {
    timeoutMs: 8_000,
    maxBytes: 5_000_000,
    maxRedirects: 2,
  });
  // `ice_source_reports.source_url` requires https. A publisher that
  // downgrades during a redirect still gets its discovery URL as provenance.
  const canonicalUrl = page.finalUrl.startsWith('https://') ? page.finalUrl : discovery.url;
  const title = extractTitle(page.text) || discovery.title;
  const text = readableText(page.text);
  if (text.length < MIN_RELEVANT_TEXT) {
    await recordDecision(
      client,
      discovery.id,
      null,
      'rejected',
      'auto: too little readable text',
    );
    return { id: discovery.id, status: 'rejected', reason: 'too little readable text' };
  }
  if (!discoveryRelevance(title, text)) {
    await recordDecision(
      client,
      discovery.id,
      null,
      'rejected',
      'auto: no ICE enforcement content after deterministic screen',
    );
    return {
      id: discovery.id,
      status: 'rejected',
      reason: 'no ICE enforcement content (deterministic)',
    };
  }

  if (deadline - Date.now() < AI_TIMEOUT_MS + 4_000) {
    return { id: discovery.id, status: 'deferred', reason: 'AI screen budget unavailable' };
  }

  let refined: { isReport: boolean; text: string } | null;
  try {
    refined = await refineWithAi(text, canonicalUrl, title);
  } catch (error) {
    const message = shortError(error);
    if (/AI screen unavailable/i.test(message)) {
      // The provider, not the page, failed. Rotate the candidate to the back
      // without incrementing its attempt count, then let the whole-batch
      // circuit breaker in `runIntake` decide whether this run was healthy.
      await rotateDiscovery(client, discovery.id, `auto retry: ${message}`);
      return { id: discovery.id, status: 'retry', reason: message, aiUnavailable: true };
    }
    throw error;
  }
  if (!refined) {
    const state = await recordAttempt(
      client,
      discovery.id,
      'auto retry: AI screen did not complete',
    );
    return {
      id: discovery.id,
      status: state === 'exhausted' ? 'exhausted' : 'retry',
      reason:
        state === 'exhausted'
          ? 'retry limit reached after repeated AI screen failures'
          : 'AI screen did not complete; candidate left pending',
    };
  }
  if (!refined.isReport) {
    await recordDecision(
      client,
      discovery.id,
      null,
      'rejected',
      'auto: AI screen found no ICE case report',
    );
    return { id: discovery.id, status: 'rejected', reason: 'AI screen: not an ICE case report' };
  }

  const summary = refined.text.trim().slice(0, MAX_SUMMARY_CHARS);
  // The edge screen is authoritative, but the same public-panel grounding
  // check the Next intake applies still runs here: a provider bug must not
  // publish copied prose, markup or an invented number from either path.
  if (!isAttributedSourceDigest(text, summary, title)) {
    await recordDecision(
      client,
      discovery.id,
      null,
      'rejected',
      'auto: AI screen returned a title-only, copied, or unattributed digest',
    );
    return {
      id: discovery.id,
      status: 'rejected',
      reason: 'AI screen returned a title-only, copied, or unattributed digest',
    };
  }

  const now = new Date().toISOString();
  const pageRow = await client
    .from('ice_crawl_pages')
    .upsert(
      {
        source_id: source.id,
        url: discovery.url,
        final_url: canonicalUrl,
        http_status: page.status,
        content_type: page.contentType,
        title: title.slice(0, 500),
        text_content: summary,
        extraction_method: 'ai',
        fetched_at: now,
      },
      { onConflict: 'source_id,url' },
    )
    .select('*')
    .single();
  if (pageRow.error || !pageRow.data?.id) {
    throw new Error(`page insert failed: ${pageRow.error?.message ?? 'no row returned'}`);
  }

  const publisher = publisherName(discovery, canonicalUrl);
  const sourceText = `${summary}\n\nAttributed summary from ${publisher}. Read the full report at ${canonicalUrl}`;
  const inserted = await client
    .from('ice_source_reports')
    .upsert(
      [
        {
          source_id: source.id,
          page_id: pageRow.data.id,
          source_name: publisher,
          source_url: canonicalUrl,
          source_title: title.slice(0, 500),
          source_published_at: discovery.published_at ?? extractPublishedAt(page.text),
          source_retrieved_at: now,
          title: title.slice(0, 240),
          text_content: sourceText,
          city: null,
          state_code: null,
          kind: classifyReportKind(`${title}\n${text}`),
          extraction_method: 'ai',
          dedupe_key: `discovery:${canonicalUrl}`,
          published_at: now,
          publication_status: PUBLICATION_STATUS,
          provenance: 'discovery',
          rights_status: 'unconfirmed',
          summary,
          discovery_id: discovery.id,
        },
      ],
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )
    .select('id');

  if (inserted.error) throw new Error(`report insert failed: ${inserted.error.message}`);
  if ((inserted.data?.length ?? 0) === 0) {
    await recordDecision(
      client,
      discovery.id,
      source.id,
      'approved',
      'auto: duplicate report URL',
    );
    return { id: discovery.id, status: 'duplicate', reason: 'dedupe key already present' };
  }

  let images = 0;
  let imageErrors: string[] = [];
  try {
    const imageResult = await storeEvidenceImages({
      client,
      sourceId: source.id,
      pageId: pageRow.data.id,
      pageUrl: canonicalUrl,
      html: page.text,
      deadline: Math.min(deadline, Date.now() + IMAGE_BUDGET_MS),
    });
    images = imageResult.stored;
    imageErrors = imageResult.errors.slice(0, 3);
  } catch (error) {
    // The report is already stored; an image failure is isolated but visible
    // in the run detail so a silent bucket/encoder break cannot hide.
    imageErrors = [shortError(error)];
  }

  await recordDecision(
    client,
    discovery.id,
    source.id,
    'approved',
    'auto: AI ICE screen passed; attributed summary only',
  );
  log('ice_scan_report', {
    discoveryId: discovery.id,
    host: new URL(canonicalUrl).hostname,
    publication: PUBLICATION_STATUS,
    images,
    imageErrors,
  });
  return {
    id: discovery.id,
    status: 'report',
    reason: 'AI-screened attributed summary admitted',
    reportId: inserted.data?.[0]?.id,
    images,
    imageErrors,
  };
}

async function runIntake(
  client: SupabaseClient<any>,
  limit: number,
  deadline: number,
): Promise<PhaseResult> {
  const source = await ensureDiscoverySource(client);
  const pending = await listPending(client, limit);
  const outcomes: IntakeOutcome[] = [];
  const errors: string[] = [];

  await mapWithConcurrency(pending, CONCURRENCY, async (discovery) => {
    if (Date.now() >= deadline - 6_000) {
      outcomes.push({
        id: discovery.id,
        status: 'deferred',
        reason: 'run deadline reached before this candidate started',
      });
      return;
    }
    try {
      outcomes.push(await processCandidate(client, source, discovery, deadline));
    } catch (error) {
      const message = shortError(error);
      const permanent = isPermanentFailure(message);
      try {
        if (permanent) {
          await recordDecision(client, discovery.id, null, 'rejected', `auto: ${message}`);
          outcomes.push({ id: discovery.id, status: 'rejected', reason: message });
        } else {
          const state = await recordAttempt(client, discovery.id, `auto retry: ${message}`);
          outcomes.push({
            id: discovery.id,
            status: state === 'exhausted' ? 'exhausted' : 'retry',
            reason:
              state === 'exhausted'
                ? `retry limit reached: ${message}`
                : message,
          });
        }
      } catch (writeError) {
        errors.push(`decision write: ${shortError(writeError)}`);
        outcomes.push({ id: discovery.id, status: 'retry', reason: message });
      }
      log('ice_scan_candidate_error', {
        discoveryId: discovery.id,
        permanent,
        error: message,
      });
    }
  });

  const decided = outcomes.filter((outcome) =>
    ['report', 'duplicate', 'rejected', 'exhausted'].includes(outcome.status),
  ).length;
  const aiOutages = outcomes.filter((outcome) => outcome.aiUnavailable).length;
  const aiFatal = outcomes.length > 0 && decided === 0 && aiOutages === outcomes.length;
  if (aiFatal) errors.push('AI screen unavailable for the entire batch');

  const summary = {
    processed: outcomes.filter((outcome) => outcome.status !== 'deferred').length,
    reports: outcomes.filter((outcome) => outcome.status === 'report').length,
    publication: PUBLICATION_STATUS,
    duplicates: outcomes.filter((outcome) => outcome.status === 'duplicate').length,
    rejected: outcomes.filter((outcome) => outcome.status === 'rejected').length,
    retried: outcomes.filter((outcome) => outcome.status === 'retry').length,
    exhausted: outcomes.filter((outcome) => outcome.status === 'exhausted').length,
    deferred: outcomes.filter((outcome) => outcome.status === 'deferred').length,
    images: outcomes.reduce((total, outcome) => total + (outcome.images ?? 0), 0),
    remaining: await countPending(client),
    fatal: aiFatal ? 'AI screen unavailable for the entire batch' : null,
    outcomes: outcomes.map((outcome) => ({
      ...outcome,
      reason: outcome.reason.slice(0, 200),
    })),
    errors: errors.slice(0, 20),
  };

  log('ice_scan_intake', {
    processed: summary.processed,
    reports: summary.reports,
    publication: summary.publication,
    duplicates: summary.duplicates,
    rejected: summary.rejected,
    retried: summary.retried,
    exhausted: summary.exhausted,
    deferred: summary.deferred,
    images: summary.images,
    remaining: summary.remaining,
  });

  return summary;
}

function parseMode(value: string | null) {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'discover' || normalized === 'intake') return normalized;
  return 'both';
}

function parseLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return INTAKE_DEFAULT;
  return Math.min(INTAKE_MAX, Math.max(1, Math.floor(parsed)));
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { 'content-type': 'application/json', ...corsHeaders(), ...NO_STORE },
    });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ ok: false, error: 'The ICE scan is not configured.' }, 503);
  }
  if (!authorized(request)) {
    return json({ ok: false, error: 'Unauthorized.' }, 401);
  }

  const url = new URL(request.url);
  const mode = parseMode(url.searchParams.get('mode'));
  const limit = parseLimit(url.searchParams.get('limit'));
  const startedAt = Date.now();
  const deadline = startedAt + SCAN_BUDGET_MS;
  const client = createClient<any>(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'ice-scan' } },
  });

  const errors: string[] = [];
  const result: Record<string, unknown> = {
    ok: true,
    mode,
    limit,
    startedAt: new Date(startedAt).toISOString(),
  };
  let runId: string | null = null;
  const claimed: string[] = [];

  try {
    const run = await client
      .from('ice_scan_runs')
      .insert({ job: mode, mode, status: 'running' })
      .select('id')
      .single();
    if (run.error || !run.data?.id) {
      throw new Error(`scan run could not start: ${run.error?.message ?? 'no row returned'}`);
    }
    runId = run.data.id;

    if (mode !== 'intake') {
      if (await claimLease(client, 'discover')) {
        claimed.push('discover');
        result.discovery = await runDiscovery(client, deadline);
      } else {
        result.discovery = { skipped: 'another discovery run holds the lease' };
      }
    }

    if (mode !== 'discover') {
      if (await claimLease(client, 'intake')) {
        claimed.push('intake');
        const intakeDeadline = Math.max(Date.now() + 10_000, deadline);
        const intakePhase = await runIntake(
          client,
          limit,
          Math.min(intakeDeadline, startedAt + SCAN_BUDGET_MS),
        );
        result.intake = intakePhase;
        if (intakePhase.fatal) {
          result.ok = false;
          errors.push(String(intakePhase.fatal));
        }
      } else {
        result.intake = { skipped: 'another intake run holds the lease' };
      }
    }
  } catch (error) {
    const message = shortError(error);
    errors.push(message);
    result.ok = false;
    result.error = message;
    log('ice_scan_failed', { mode, error: message });
  } finally {
    for (const job of claimed) await releaseLease(client, job);

    if (runId) {
      const discovery = (result.discovery ?? {}) as Record<string, unknown>;
      const intake = (result.intake ?? {}) as Record<string, unknown>;
      const found = Number(discovery.found ?? 0);
      const queued = Number(discovery.queued ?? 0);
      const processed = Number(intake.processed ?? 0);
      const reports = Number(intake.reports ?? 0);
      const skippedAll =
        (mode === 'intake' || Boolean(discovery.skipped)) &&
        (mode === 'discover' || Boolean(intake.skipped));
      const status = !result.ok
        ? 'failed'
        : skippedAll
          ? 'skipped'
          : errors.length === 0
            ? 'ok'
            : found + queued + processed + reports > 0
              ? 'degraded'
              : 'failed';
      const phaseErrors = [
        ...(Array.isArray(discovery.errors) ? discovery.errors : []),
        ...(Array.isArray(intake.errors) ? intake.errors : []),
      ]
        .map((value) => String(value).slice(0, 300))
        .slice(0, 20);

      const finished = await client
        .from('ice_scan_runs')
        .update({
          status,
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt,
          found,
          queued,
          processed,
          reports,
          duplicates: Number(intake.duplicates ?? 0),
          rejected: Number(intake.rejected ?? 0),
          retried: Number(intake.retried ?? 0),
          images: Number(intake.images ?? 0),
          remaining: intake.remaining ?? null,
          errors: [...new Set([...errors, ...phaseErrors])].slice(0, 20),
          details: {
            providers: discovery.providers ?? [],
            fallbacks: discovery.fallbacks ?? [],
            warnings: discovery.warnings ?? [],
            providerHealth:
              discovery.providerHealth && typeof discovery.providerHealth === 'object'
                ? discovery.providerHealth
                : {},
            publication: PUBLICATION_STATUS,
            exhausted: Number(intake.exhausted ?? 0),
            deferred: Number(intake.deferred ?? 0),
            skipped: [discovery.skipped, intake.skipped].filter(Boolean),
          },
        })
        .eq('id', runId);
      if (finished.error) {
        log('ice_scan_run_update_failed', { runId, error: finished.error.message });
      }
    }
  }

  result.errors = [...new Set(errors)].slice(0, 20).map((value) => value.slice(0, 300));
  result.durationMs = Date.now() - startedAt;
  log('ice_scan_complete', {
    mode,
    ok: result.ok,
    durationMs: result.durationMs,
    discovery: result.discovery,
    intake: result.intake,
  });
  return json(result, result.ok ? 200 : 500);
});
