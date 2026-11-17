import type { IceReportStore } from '@/lib/ice-report-intake';
import type { IceReportKind } from '@/lib/ice-report-shared';

/**
 * The chapter treats two reports as the same event when they share a city,
 * state and category, fall inside this window, and have substantially similar
 * private text. The window is intentionally short: an enforcement presence can
 * move or end quickly.
 */
export const ICE_REPORT_DUPLICATE_WINDOW_MS = 2 * 60 * 60 * 1_000;
export const ICE_REPORT_SIMILARITY_THRESHOLD = 0.6;

const STOPWORDS = new Set([
  'a',
  'about',
  'an',
  'and',
  'approx',
  'approximately',
  'are',
  'around',
  'as',
  'at',
  'be',
  'been',
  'by',
  'for',
  'from',
  'had',
  'has',
  'have',
  'ice',
  'in',
  'into',
  'is',
  'it',
  'its',
  'just',
  'minutes',
  'near',
  'nearby',
  'observed',
  'of',
  'on',
  'or',
  'report',
  'reported',
  'reports',
  'saw',
  'seen',
  'several',
  'some',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'to',
  'today',
  'very',
  'was',
  'were',
  'with',
  'yesterday',
]);

function normalizedText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function contentWords(value: string) {
  return normalizedText(value)
    .split(' ')
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

/**
 * Token overlap with a containment bias. It is deliberately conservative: a
 * score below the threshold leaves the report for manual review instead of
 * incorrectly combining two different events.
 */
export function iceReportSimilarity(first: string, second: string) {
  const firstText = normalizedText(first);
  const secondText = normalizedText(second);
  if (!firstText || !secondText) return 0;
  if (firstText === secondText) return 1;

  const shorter = firstText.length <= secondText.length ? firstText : secondText;
  const longer = shorter === firstText ? secondText : firstText;
  if (shorter.length >= 40 && longer.includes(shorter)) {
    return 0.9;
  }

  const firstWords = new Set(contentWords(first));
  const secondWords = new Set(contentWords(second));
  if (firstWords.size === 0 || secondWords.size === 0) return 0;

  let shared = 0;
  for (const word of firstWords) {
    if (secondWords.has(word)) shared += 1;
  }
  const union = new Set([...firstWords, ...secondWords]).size;
  return union === 0 ? 0 : shared / union;
}

export function generatedIceReportSummary(
  city: string,
  stateCode: string,
  kind: IceReportKind
) {
  const activity =
    kind === 'checkpoint'
      ? 'a checkpoint or roadblock'
      : kind === 'detention'
        ? 'detention activity'
        : 'enforcement activity';

  return `Community report of ${activity} in ${city}, ${stateCode}. City-level only; not independently verified.`;
}

/**
 * Automatic publication is limited to low-risk, city-mapped reports. These
 * flags are not a redaction engine: they route the report to a person when the
 * text suggests a person, an exact place, or a safety-sensitive event.
 */
export function autoPublishRiskIssue(summary: string, kind: IceReportKind) {
  if (kind === 'detention') {
    return 'Detention reports need manual review.';
  }

  const exactPlace =
    /\b\d{1,6}\s+[\p{L}0-9.'’\- ]{2,60}\s+(?:street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|lane|ln\.?|drive|dr\.?|court|ct\.?|way|highway|hwy\.?|freeway|fwy\.?)\b/iu;
  if (exactPlace.test(summary)) {
    return 'This report appears to include an exact address.';
  }

  const sensitivePlace =
    /\b(?:corner of|in front of|across from|parking lot|driveway|apartment|house|home of|school|preschool|daycare|university|college|church|mosque|synagogue|temple|shelter|clinic|hospital|business|store|employer|workplace)\b/iu;
  if (sensitivePlace.test(summary)) {
    return 'This report includes a safety-sensitive place.';
  }

  const sensitiveEvent =
    /\b(?:arrest(?:ed|s)?|detain(?:ed|s|ment)?|handcuff(?:ed|s)?|gun|guns|weapon|weapons|firearm|shot|shots|injured|injury|medical|ambulance)\b/iu;
  if (sensitiveEvent.test(summary)) {
    return 'This report includes a safety-sensitive event.';
  }

  return null;
}

export type SimilarReportCandidate = {
  id: string;
  summary: string;
  observed_at: string;
  public_report_id: string | null;
};

export type SimilarIceReport = {
  publicReportId: string;
  similarity: number;
  observedAt: string;
};

/** Rank active candidates and return only a sufficiently close match. */
export function bestSimilarIceReport(
  summary: string,
  candidates: readonly SimilarReportCandidate[],
  activePublicIds: ReadonlySet<string>
): SimilarIceReport | null {
  let best: SimilarIceReport | null = null;
  for (const candidate of candidates) {
    if (!candidate.public_report_id || !activePublicIds.has(candidate.public_report_id)) continue;
    const similarity = iceReportSimilarity(summary, candidate.summary);
    if (similarity < ICE_REPORT_SIMILARITY_THRESHOLD) continue;
    if (!best || similarity > best.similarity) {
      best = {
        publicReportId: candidate.public_report_id,
        similarity,
        observedAt: candidate.observed_at,
      };
    }
  }
  return best;
}

/**
 * Find the strongest published near-duplicate for a report. Only active public
 * rows are considered; expired entries cannot accept a merge.
 */
export async function findSimilarIceReport(
  store: IceReportStore,
  report: Pick<SimilarReportCandidate, 'summary' | 'observed_at'> & {
    city: string;
    state_code: string;
    kind: IceReportKind;
  }
): Promise<SimilarIceReport | null> {
  const observedAt = Date.parse(report.observed_at);
  if (!Number.isFinite(observedAt)) return null;

  const windowStart = new Date(observedAt - ICE_REPORT_DUPLICATE_WINDOW_MS).toISOString();
  const windowEnd = new Date(observedAt + ICE_REPORT_DUPLICATE_WINDOW_MS).toISOString();

  const { data, error } = await store
    .from('ice_report_intake')
    .select('id, summary, observed_at, public_report_id')
    .eq('status', 'published')
    .eq('state_code', report.state_code)
    .eq('kind', report.kind)
    .ilike('city', report.city)
    .not('public_report_id', 'is', null)
    .gte('observed_at', windowStart)
    .lte('observed_at', windowEnd)
    .order('observed_at', { ascending: false })
    .limit(25);

  if (error) throw new Error(`ice report duplicate lookup failed: ${error.message}`);
  const rows = (data ?? []) as SimilarReportCandidate[];
  const publicIds = rows
    .map((row) => row.public_report_id)
    .filter((id): id is string => Boolean(id));
  if (publicIds.length === 0) return null;

  const { data: activeRows, error: activeError } = await store
    .from('ice_public_reports')
    .select('id')
    .in('id', publicIds)
    .gt('expires_at', new Date().toISOString());
  if (activeError) {
    throw new Error(`ice report duplicate expiry check failed: ${activeError.message}`);
  }
  const active = new Set((activeRows ?? []).map((row) => row.id));
  return bestSimilarIceReport(report.summary, rows, active);
}

export async function autoPublishOrMergeIceReport(
  store: IceReportStore,
  report: {
    id: string;
    city: string;
    state_code: string;
    kind: IceReportKind;
    observed_at: string;
    summary: string;
  },
  lat: number,
  lng: number
) {
  const similar = await findSimilarIceReport(store, report);
  const { data, error } = await store.rpc('ice_auto_publish_report', {
    p_report_id: report.id,
    p_lat: lat,
    p_lng: lng,
    p_public_summary: generatedIceReportSummary(report.city, report.state_code, report.kind),
    p_merge_public_id: similar?.publicReportId ?? null,
  });

  if (error) throw new Error(`ice report automatic publication failed: ${error.message}`);
  return { publicReportId: data, merged: Boolean(similar) };
}
