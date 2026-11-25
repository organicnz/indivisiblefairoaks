/**
 * AI triage for the nationwide discovery queue.
 *
 * The queue is a headline index, not a case list. A pending row can be a
 * specific ICE raid, a syndicated copy of the same raid, an opinion piece about
 * immigration politics, or a story about frozen water that matched the word
 * "ice". This pass gives each candidate a bounded relevance score, a
 * confidence band and a duplicate pointer so an admin sees the strongest leads
 * first without losing the oldest rows.
 *
 * Three properties are deliberate:
 *
 * - It never publishes. Triage writes review metadata on
 *   `ice_crawl_discoveries`; the human rights confirmation and crawl remain the
 *   only path into `ice_source_reports`.
 * - It is bounded. Batches are small, the whole pass has a deadline, and a
 *   provider failure falls back to a deterministic screen instead of leaving
 *   the queue unranked.
 * - It collapses stories across the whole loaded batch, not just within one
 *   model call: syndicated headlines often differ by only a suffix, and a
 *   story seen twice should consume one review slot.
 */

import { env } from '@/lib/env';
import {
  applyIceCrawlDiscoveryTriage,
  countReviewableIceCrawlDiscoveries,
  type IceCrawlDiscoveryTriageRow,
  type IceCrawlStore,
  listPendingIceCrawlDiscoveriesForTriage,
} from '@/lib/ice-crawl-store';
import type {
  IceCrawlDiscovery,
  IceCrawlDiscoveryTriageConfidence,
  IceCrawlDiscoveryTriageRelevance,
} from '@/lib/ice-crawl-types';

export const TRIAGE_BATCH_SIZE = 25;
export const TRIAGE_MAX_CANDIDATES = 200;
export const TRIAGE_AI_MODEL = 'glm-4.5-flash';

// The model keys live in the Supabase project, not in the Vercel deployment.
// The edge function is the only caller that spends them, matching the pattern
// `ice-source-refine` uses for the crawler.
const AI_TIMEOUT_MS = 30_000;
const DUPLICATE_WINDOW_MS = 3 * 24 * 60 * 60 * 1_000;
const DUPLICATE_SIMILARITY = 0.78;
const MIN_TITLE_TOKENS = 4;

const TRIAGE_STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'are',
  'was',
  'were',
  'has',
  'have',
  'had',
  'into',
  'over',
  'after',
  'before',
  'says',
  'said',
  'about',
  'their',
  'they',
  'them',
  'will',
  'would',
  'could',
  'been',
  'being',
  'more',
  'than',
  'then',
  'when',
  'where',
  'which',
  'while',
  'who',
  'whom',
  'its',
  'his',
  'her',
  'new',
  'update',
  'live',
]);

const ICE_AGENCY = /\bice\b|immigration and customs enforcement/i;
const ENFORCEMENT =
  /\b(?:raid|raids|arrest|arrests|arrested|detain|detained|detention|deport|deported|deportation|checkpoint|checkpoints|enforcement|operation|operations|sweep|sweeps|worksite|worksites|agents?|287\s*\(\s*g\s*\)|redada|redadas|arresto|arrestos|agentes)\b/i;
const IMMIGRATION =
  /\b(?:immigration|immigrant|immigrants|migrant|migrants|asylum|deportation|detention|removal|inmigraci[oó]n|inmigrante|inmigrantes|migrante|migrantes)\b/i;
const DETENTION =
  /\b(?:detain|detained|detention|jail|prison|holding|facility|bond|removal|detenci[oó]n)\b/i;
const CHECKPOINT =
  /\b(?:checkpoint|checkpoints|roadblock|traffic stop|puesto de control|ret[eé]n)\b/i;
const FROZEN_ICE =
  /\bice(?:[- ](?:cube|cubes|berg|bergs|age|ages|cream|hockey|skating|rink|storm|shelf|field|cap|sheet|pick|picks|water|bath|machine|road|hotel|sculpture|fishing|breaker|dance|temperature|pack|packed))\b|\b(?:frozen|melting|sea|polar|arctic|glacier)\s+ice\b/i;

export type AiTriageDecision = {
  score: number;
  confidence: IceCrawlDiscoveryTriageConfidence;
  relevance: IceCrawlDiscoveryTriageRelevance;
  reason: string;
  duplicate_of: string | null;
  model: string;
};

export type IceDiscoveryTriageSummary = {
  examined: number;
  triaged: number;
  aiTriaged: number;
  heuristicTriaged: number;
  collapsedDuplicates: number;
  highConfidence: number;
  remaining: number;
  errors: string[];
};

export type TriageOptions = {
  limit?: number;
  batchSize?: number;
  deadline?: number;
};

type TriageCandidate = Pick<
  IceCrawlDiscovery,
  'id' | 'title' | 'publisher' | 'published_at' | 'url' | 'discovered_at'
>;

/** Normalize a headline into meaningful tokens for cross-batch duplicate collapse. */
function stemTriageToken(token: string) {
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

export function triageTitleTokens(value: string) {
  const tokens = value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token.length >= 3 && !TRIAGE_STOPWORDS.has(token))
    .map(stemTriageToken);
  return new Set(tokens);
}

function tokenSimilarity(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
}

function datesClose(left: string | null, right: string | null) {
  if (!left || !right) return true;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return false;
  return Math.abs(leftTime - rightTime) <= DUPLICATE_WINDOW_MS;
}

/**
 * Group syndicated headlines by token overlap and publication proximity.
 * The oldest canonical row wins, so a duplicate never displaces the row the
 * queue was going to reach first.
 */
export function collapseDuplicateDiscoveries(rows: readonly TriageCandidate[]) {
  const ordered = [...rows].sort(
    (left, right) =>
      left.discovered_at.localeCompare(right.discovered_at) || left.id.localeCompare(right.id)
  );
  const tokensById = new Map(ordered.map((row) => [row.id, triageTitleTokens(row.title)]));
  const canonicals: TriageCandidate[] = [];
  const duplicateOf = new Map<string, string>();

  for (const row of ordered) {
    const tokens = tokensById.get(row.id) ?? new Set<string>();
    if (tokens.size < MIN_TITLE_TOKENS) {
      canonicals.push(row);
      continue;
    }

    const match = canonicals.find((candidate) => {
      if (!datesClose(row.published_at, candidate.published_at)) return false;
      const candidateTokens = tokensById.get(candidate.id) ?? new Set<string>();
      return tokenSimilarity(tokens, candidateTokens) >= DUPLICATE_SIMILARITY;
    });

    if (match) {
      duplicateOf.set(row.id, match.id);
    } else {
      canonicals.push(row);
    }
  }

  return duplicateOf;
}

function confidenceForScore(score: number): IceCrawlDiscoveryTriageConfidence {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function relevanceForScore(score: number, text: string): IceCrawlDiscoveryTriageRelevance {
  if (score < 30) return 'off_topic';
  if (CHECKPOINT.test(text)) return 'checkpoint';
  if (DETENTION.test(text)) return 'detention';
  if (ENFORCEMENT.test(text)) return 'enforcement';
  return 'related';
}

/**
 * Deterministic fallback when the provider is unavailable. It is intentionally
 * conservative: an explicit ICE enforcement verb scores high, immigration
 * enforcement without a named agency scores medium, and the frozen-water word
 * is rejected rather than ranked.
 */
export function heuristicTriageDecision(row: TriageCandidate): AiTriageDecision {
  const text = `${row.title}\n${row.publisher ?? ''}`;
  const frozen = FROZEN_ICE.test(text);
  const ice = ICE_AGENCY.test(text);
  const enforcement = ENFORCEMENT.test(text);
  const immigration = IMMIGRATION.test(text);
  const detention = DETENTION.test(text);
  const checkpoint = CHECKPOINT.test(text);

  let score = 4;
  let reason = 'No ICE enforcement signal in the headline.';
  if (frozen && !enforcement) {
    score = 2;
    reason = 'Headline uses the frozen-water word "ice", not the agency.';
  } else if (/\b287\s*\(\s*g\s*\)/.test(text)) {
    score = 82;
    reason = '287(g) agreement mentioned with an enforcement context.';
  } else if (ice && (enforcement || detention || checkpoint)) {
    score = checkpoint ? 88 : detention ? 90 : 92;
    reason = 'Explicit ICE mention with a concrete enforcement action.';
  } else if (ice) {
    score = 45;
    reason = 'Mentions ICE without a concrete enforcement action.';
  } else if (immigration && enforcement) {
    score = 58;
    reason = 'Immigration enforcement story without a named ICE role.';
  } else if (immigration) {
    score = 28;
    reason = 'Immigration topic without a specific enforcement event.';
  }

  return {
    score,
    confidence: confidenceForScore(score),
    relevance: relevanceForScore(score, text),
    reason,
    duplicate_of: null,
    model: 'deterministic',
  };
}

function stripCodeFence(raw: string) {
  return raw
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

function parseJsonCandidate(raw: string): unknown {
  const direct = stripCodeFence(raw);
  try {
    return JSON.parse(direct);
  } catch {
    const objectStart = direct.indexOf('{');
    const arrayStart = direct.indexOf('[');
    const start =
      objectStart >= 0 && (arrayStart < 0 || objectStart < arrayStart) ? objectStart : arrayStart;
    if (start < 0) return null;
    const closing = direct[start] === '{' ? '}' : ']';
    const end = direct.lastIndexOf(closing);
    if (end <= start) return null;
    try {
      return JSON.parse(direct.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/**
 * Validate every field before it reaches the database. The model is untrusted
 * output: an id that was not in the batch, a score outside 0-100, or a
 * duplicate pointer to itself is discarded rather than stored.
 */
export function parseAiTriageResponse(
  raw: string,
  candidates: readonly Pick<IceCrawlDiscovery, 'id'>[],
  model = TRIAGE_AI_MODEL
): Map<string, AiTriageDecision> | null {
  const parsed = parseJsonCandidate(raw);
  if (!parsed || typeof parsed !== 'object') return null;

  const results = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { results?: unknown }).results)
      ? (parsed as { results: unknown[] }).results
      : null;
  if (!results) return null;

  const ids = new Set(candidates.map((candidate) => candidate.id));
  const decisions = new Map<string, AiTriageDecision>();

  for (const value of results) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const item = value as Record<string, unknown>;
    const id = typeof item.id === 'string' ? item.id : '';
    if (!ids.has(id)) continue;

    const rawScore = typeof item.score === 'number' ? item.score : Number(item.score);
    if (!Number.isFinite(rawScore)) continue;
    const score = Math.min(100, Math.max(0, Math.round(rawScore)));

    const confidence: IceCrawlDiscoveryTriageConfidence =
      item.confidence === 'high' || item.confidence === 'medium' || item.confidence === 'low'
        ? item.confidence
        : confidenceForScore(score);
    const relevance: IceCrawlDiscoveryTriageRelevance =
      item.relevance === 'enforcement' ||
      item.relevance === 'detention' ||
      item.relevance === 'checkpoint' ||
      item.relevance === 'related' ||
      item.relevance === 'off_topic'
        ? item.relevance
        : relevanceForScore(score, '');
    const reason =
      typeof item.reason === 'string' && item.reason.trim()
        ? item.reason.trim().slice(0, 400)
        : `AI relevance score ${score}/100.`;
    const duplicate =
      typeof item.duplicate_of === 'string' &&
      ids.has(item.duplicate_of) &&
      item.duplicate_of !== id
        ? item.duplicate_of
        : null;

    decisions.set(id, {
      score,
      confidence,
      relevance,
      reason,
      duplicate_of: duplicate,
      model,
    });
  }

  return decisions.size > 0 ? decisions : null;
}

function resolveCanonical(id: string, direct: Map<string, string>) {
  let current = id;
  const seen = new Set([id]);
  while (direct.has(current)) {
    const next = direct.get(current) ?? current;
    if (seen.has(next)) break;
    seen.add(next);
    current = next;
  }
  return current;
}

/**
 * Merge model decisions, deterministic fallback decisions and duplicate groups
 * into one row per candidate. A duplicate chain is flattened to its canonical
 * row so the admin list never points at another hidden duplicate.
 */
export function mergeTriageDecisions(
  rows: readonly TriageCandidate[],
  aiDecisions: Map<string, AiTriageDecision>,
  duplicates: Map<string, string>
) {
  const direct = new Map<string, string>();
  for (const row of rows) {
    const canonical = duplicates.get(row.id) ?? aiDecisions.get(row.id)?.duplicate_of ?? null;
    if (canonical && canonical !== row.id) direct.set(row.id, canonical);
  }

  return rows.map((row): IceCrawlDiscoveryTriageRow => {
    const ai = aiDecisions.get(row.id);
    const decision = ai ?? heuristicTriageDecision(row);
    const canonical = resolveCanonical(row.id, direct);
    return {
      id: row.id,
      score: decision.score,
      confidence: decision.confidence,
      relevance: decision.relevance,
      reason: decision.reason,
      model: decision.model,
      duplicate_of: canonical === row.id ? null : canonical,
    };
  });
}

async function requestAiTriage(
  rows: readonly TriageCandidate[]
): Promise<Map<string, AiTriageDecision> | null> {
  const base = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key || rows.length === 0) return null;

  const candidates = rows.map((row) => ({
    id: row.id,
    title: row.title.slice(0, 300),
    publisher: row.publisher?.slice(0, 120) ?? null,
    published_at: row.published_at,
  }));

  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/functions/v1/ice-discovery-triage`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ candidates }),
      cache: 'no-store',
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as { model?: unknown };
    const model =
      typeof payload.model === 'string' && payload.model.trim()
        ? payload.model.trim().slice(0, 80)
        : TRIAGE_AI_MODEL;
    return parseAiTriageResponse(JSON.stringify(payload), rows, model);
  } catch {
    return null;
  }
}

/**
 * Run one bounded triage pass. Processed batches are persisted immediately, so
 * a deadline that cuts the pass short still leaves the queue better ranked than
 * it was before the call.
 */
export async function triagePendingDiscoveries(
  store: IceCrawlStore,
  options: TriageOptions = {}
): Promise<IceDiscoveryTriageSummary> {
  const limit = Math.min(
    Math.max(1, options.limit ?? TRIAGE_MAX_CANDIDATES),
    TRIAGE_MAX_CANDIDATES
  );
  const batchSize = Math.min(Math.max(5, options.batchSize ?? TRIAGE_BATCH_SIZE), 50);
  const deadline = options.deadline ?? Date.now() + 45_000;
  const pending = await listPendingIceCrawlDiscoveriesForTriage(store, limit);
  const duplicates = collapseDuplicateDiscoveries(pending);
  const errors: string[] = [];
  let triaged = 0;
  let aiTriaged = 0;
  let heuristicTriaged = 0;
  let collapsedDuplicates = 0;
  let highConfidence = 0;
  let aiFailures = 0;
  let batches = 0;

  for (let offset = 0; offset < pending.length; offset += batchSize) {
    if (Date.now() >= deadline) break;
    const batch = pending.slice(offset, offset + batchSize);
    if (batch.length === 0) break;

    const ai = await requestAiTriage(batch);
    batches += 1;
    if (ai) {
      aiTriaged += ai.size;
    } else {
      aiFailures += 1;
    }

    const decisions = mergeTriageDecisions(batch, ai ?? new Map(), duplicates);
    const applied = await applyIceCrawlDiscoveryTriage(store, decisions);
    triaged += applied;
    heuristicTriaged += decisions.length - (ai?.size ?? 0);
    collapsedDuplicates += decisions.filter((row) => row.duplicate_of !== null).length;
    highConfidence += decisions.filter(
      (row) =>
        row.duplicate_of === null && row.confidence === 'high' && row.relevance !== 'off_topic'
    ).length;
  }

  if (aiFailures > 0) {
    errors.push(
      `AI triage was unavailable for ${aiFailures} of ${batches} batch(es); the deterministic screen ranked those rows.`
    );
  }

  let remaining = 0;
  try {
    remaining = await countReviewableIceCrawlDiscoveries(store);
  } catch {
    remaining = Math.max(0, pending.length - triaged);
  }

  return {
    examined: triaged,
    triaged,
    aiTriaged,
    heuristicTriaged,
    collapsedDuplicates,
    highConfidence,
    remaining,
    errors,
  };
}
