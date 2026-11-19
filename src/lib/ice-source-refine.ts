import type { IceSourceExtractionMethod } from '@/lib/ice-crawl-types';
import { env } from '@/lib/env';

/**
 * The crawler stores readable page text, but government newsroom pages wrap
 * the report in navigation, cookie/consent copy and a feedback survey. The
 * refinement endpoint asks a model to select the source lines that belong to
 * the report; the line text itself is never rewritten.
 */
const MAX_AI_REFINE_CHARS = 24_000;
const REFINE_TIMEOUT_MS = 35_000;
const MAX_STORED_CHARS = 500_000;

export type SourceRefinement = {
  isReport: boolean;
  text: string;
};

const CHROME_LINES = new Set([
  'skip to main content',
  'skip to navigation',
  'quick links',
  'main navigation',
  'menu',
  'secretary markwayne mullin',
  'an official website of the united states government',
  'here’s how you know',
  "here's how you know",
  'official websites use .gov',
  'a .gov website belongs to an official government organization in the united states.',
  'secure .gov websites use https',
  'a lock',
  '( )',
  'or https:// means you’ve safely connected to the .gov website. share sensitive information only on official, secure websites.',
  'press enter to search',
  'open menu',
  'close menu',
  'topics',
  'border security',
  'citizenship and immigration',
  'cybersecurity',
  'disasters',
  'election security',
  'homeland security enterprise',
  'human trafficking',
  'immigration and customs enforcement',
  'preventing terrorism and targeted violence',
  'resilience',
  'science and technology',
  'trade and economic security',
  'transportation security',
  'news',
  'all dhs news',
  'apps',
  'blog',
  'comunicados de prensa',
  'data',
  'events',
  'featured news',
  'homeland security live',
  'media contacts',
  'media library',
  'national terrorism advisory system',
  'press releases',
  'publications library',
  'social media',
  'subscribe',
  'in focus',
  'one year of voice',
  'worst of the worst',
  'angel families project',
  'making america safe again',
  'cbp home',
  'fentanyl',
  'independent review of 2024 attempted assassination',
  'how do i?',
  'alphabetical listing',
  'at dhs',
  'for businesses',
  'for travelers',
  'for the public',
  'get involved',
  'blue campaign',
  'if you see something, say something®',
  'know2protect',
  'nationwide sar initiative',
  'ready.gov',
  'secure our world',
  'us coast guard auxiliary',
  'about dhs',
  'budget & performance',
  'budget &amp; performance',
  'laws &amp; regulations',
  'customer experience and service delivery',
  'headquarters eeo office',
  'contact us',
  'employee resources',
  'history',
  'homeland security careers',
  'in memoriam',
  'laws & regulations',
  'leadership',
  'mission',
  'organization',
  'site links',
  'breadcrumb',
  'home',
  'resources',
  'related content',
  'keywords',
  'back to top',
  'follow us',
  'share',
  'print',
  'email',
  'yes',
  'no',
]);

function cleanLine(value: string) {
  return value.normalize('NFKC').replace(/[ \t]+/g, ' ').trim();
}

function lineKey(value: string) {
  return cleanLine(value).toLowerCase();
}

function normalizeText(value: string) {
  return value
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Deterministic best effort when the AI endpoint is unavailable. It removes
 * exact navigation labels and cuts the page at its feedback survey; it never
 * rewrites a sentence, so a bad fallback is still source text rather than
 * invented prose.
 */
export function cleanSourceTextFallback(value: string) {
  const lines = value.replace(/\r/g, '').split('\n');
  // ICE pages render a site-wide navigation column before the article and
  // place this toolbar immediately above the real headline. Starting after it
  // removes thousands of menu lines without dropping report text. Pages that
  // do not carry the toolbar are left unchanged.
  const shareIndex = lines.findIndex((line) => lineKey(line) === 'share on facebook');
  const articleStart =
    shareIndex >= 0
      ? lines.findIndex(
          (line, index) => index > shareIndex && lineKey(line) === 'print this page'
        )
      : -1;
  const bodyLines = articleStart >= 0 ? lines.slice(articleStart + 1) : lines;
  const output: string[] = [];

  for (const rawLine of bodyLines) {
    const line = cleanLine(rawLine);
    if (!line) {
      if (output.length > 0 && output[output.length - 1] !== '') output.push('');
      continue;
    }

    const key = lineKey(line);
    if (/^was this page helpful\?/.test(key)) break;
    if (/^this page was not helpful because/.test(key)) break;
    if (CHROME_LINES.has(key)) continue;
    if (/^[×x]$/.test(key)) continue;
    if (/^•+$/.test(key)) continue;

    output.push(line);
  }

  return normalizeText(output.join('\n')).slice(0, MAX_STORED_CHARS);
}

/**
 * Every HTML page and whole-page fallback gets one classification call. HTML
 * extraction can return a generic agency page as easily as a report, and only
 * the model reliably tells them apart; feed entries are already source-shaped.
 * Keeping the decision here also makes the fallback path testable.
 */
export function shouldRefineSourceText(
  method: IceSourceExtractionMethod,
  _text: string
) {
  return method === 'html' || method === 'fallback';
}

const ICE_SIGNAL = /\b(?:ice|immigration and customs enforcement|immigration enforcement)\b/i;
const REPORT_SIGNAL =
  /\b(?:report(?:ed|s|ing)?|sighting|seen|spotted|activity|raid|checkpoint|arrest(?:ed|s|ing)?|detain(?:ed|s|ing)?|detainer|deport(?:s|ed|ation|ing)?|apprehend(?:ed|s|ing)?|seiz(?:e|ed|es|ing)|encounter(?:ed|s)?|agents?|vehicles?|operation|sweep|worksite)\b/i;
const INDEX_PAGE =
  /^(?:archive|news releases and statements|press releases|ice leadership|live streams|check-in|social media|annual report|mission|leadership|law enforcement|news about hsi|comunicados de prensa|federal cx|measuring cx|cx learning|cx resources|why cx|customer experience|dhs headquarters eeo|civil rights|civil liberties|veterans and homeland security|financial assistance|immigration options for victims|citizenship and immigration results|cross-border trucking|policies, procedures|service beyond the uniform|hsi operations|privacy|international engagement|academic engagement|lapse in federal funding)\b/i;
const STATISTICS_PAGE = /\b(?:statistics|fiscal year|fy20\d\d|data table|monthly)\b/i;

/**
 * Last-resort publication gate for a whole-page fallback. A navigation page
 * can mention ICE and law enforcement without containing a report; requiring
 * a report verb and rejecting obvious index/statistics pages is deliberately
 * conservative.
 */
export function isLikelySourceReport(value: string) {
  const text = cleanSourceTextFallback(value);
  if (!ICE_SIGNAL.test(text) || !REPORT_SIGNAL.test(text)) return false;

  const opening = text.split('\n').slice(0, 4).join(' ');
  if (INDEX_PAGE.test(opening)) return false;
  if (STATISTICS_PAGE.test(opening) && !/\b(?:reported|sighting|spotted|said|statement)\b/i.test(text)) {
    return false;
  }
  return true;
}

function groundedRefinement(source: string, refined: string) {
  const sourceLines = new Set(
    cleanSourceTextFallback(source)
      .split('\n')
      .map(lineKey)
      .filter(Boolean)
  );
  for (const line of cleanSourceTextFallback(refined).split('\n')) {
    const key = lineKey(line);
    if (!key || key.length < 20) continue;
    if (!sourceLines.has(key)) return false;
  }
  return true;
}

/**
 * Call the Supabase edge function. The Next.js deployment does not need its
 * own model key: the function uses the AI provider secrets already held by
 * the Supabase project. Any failure returns null so the crawler can fall back
 * to deterministic cleaning or skip a non-report page.
 */
const MIN_REPORT_DIGEST_CHARS = 120;
const MAX_REPORT_DIGEST_CHARS = 5_000;
const MAX_VERBATIM_WORDS = 12;

function digestWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function numberTokens(value: string) {
  return [...value.matchAll(/\d[\d,.]*/g)]
    .map((match) => match[0].replace(/[.,]+$/g, '').replace(/,/g, ''))
    .filter(Boolean);
}

/** A digest must not contain an invented statistic, date or identifier. */
export function digestInventsNumber(source: string, digest: string) {
  const allowed = new Set(numberTokens(source));
  return numberTokens(digest).some((token) => !allowed.has(token));
}

/** Reject a copied passage even when punctuation or whitespace differs. */
export function digestRepeatsSource(source: string, digest: string) {
  const sourceWords = digestWords(source);
  const outputWords = digestWords(digest);
  if (outputWords.length < MAX_VERBATIM_WORDS) return false;

  const shingles = new Set<string>();
  for (let index = 0; index <= sourceWords.length - MAX_VERBATIM_WORDS; index += 1) {
    shingles.add(sourceWords.slice(index, index + MAX_VERBATIM_WORDS).join(' '));
  }
  if (shingles.size === 0) return false;

  for (let index = 0; index <= outputWords.length - MAX_VERBATIM_WORDS; index += 1) {
    if (shingles.has(outputWords.slice(index, index + MAX_VERBATIM_WORDS).join(' '))) {
      return true;
    }
  }
  return false;
}

/**
 * The public reading panel only shows a digest that is long enough to be a
 * real summary, stays within the storage constraint, has no markup or links,
 * introduces no number absent from the source and does not copy a long run.
 */
export function isSafeSourceDigest(source: string, digest: string) {
  if (digest.length < MIN_REPORT_DIGEST_CHARS || digest.length > MAX_REPORT_DIGEST_CHARS) {
    return false;
  }
  if (/https?:\/\/|www\./i.test(digest)) return false;
  if (/[<>]/.test(digest)) return false;
  if (/(?:\*\*|__|```|^\s*[-*#]\s)/m.test(digest)) return false;
  if (digestInventsNumber(source, digest)) return false;
  return !digestRepeatsSource(source, digest);
}

/**
 * Ask the same Supabase edge function for a paraphrase, not a line selection.
 * The digest is checked again here because the database cache is public: a
 * provider bug must never put copied or invented prose on the reading panel.
 */
export async function refineSourceReportWithAi(input: {
  text: string;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
}): Promise<SourceRefinement | null> {
  const text = cleanSourceTextFallback(input.text);
  if (text.length < 40 || text.length > MAX_AI_REFINE_CHARS) return null;

  const base = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return null;

  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/functions/v1/ice-source-refine`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        sourceUrl: input.sourceUrl ?? null,
        sourceTitle: input.sourceTitle ?? null,
        mode: 'refine',
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(REFINE_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      isReport?: unknown;
      text?: unknown;
    };
    if (typeof payload.isReport !== 'boolean') return null;
    if (!payload.isReport) return { isReport: false, text: '' };
    if (typeof payload.text !== 'string') return null;

    const digest = normalizeText(payload.text);
    if (!isSafeSourceDigest(text, digest)) return null;
    return { isReport: true, text: digest };
  } catch {
    return null;
  }
}

export async function refineSourceTextWithAi(input: {
  text: string;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
}): Promise<SourceRefinement | null> {
  const text = cleanSourceTextFallback(input.text);
  if (text.length < 40 || text.length > MAX_AI_REFINE_CHARS) return null;

  const base = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return null;

  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/functions/v1/ice-source-refine`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        sourceUrl: input.sourceUrl ?? null,
        sourceTitle: input.sourceTitle ?? null,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(REFINE_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      isReport?: unknown;
      text?: unknown;
    };
    if (typeof payload.isReport !== 'boolean') return null;
    if (!payload.isReport) return { isReport: false, text: '' };
    if (typeof payload.text !== 'string') return null;

    const refined = cleanSourceTextFallback(payload.text);
    if (refined.length < 40 || !groundedRefinement(text, refined)) return null;
    return { isReport: true, text: refined };
  } catch {
    return null;
  }
}
