/**
 * Source-grounding checks for an AI-written report digest.
 *
 * This module is deliberately dependency-free so the Next.js intake and the
 * Supabase edge scanner can share one definition. The database cache is
 * public: a provider bug or a copied passage must never reach the reading
 * panel, whichever runtime admitted the report.
 */

const MIN_REPORT_DIGEST_CHARS = 120;
const MAX_REPORT_DIGEST_CHARS = 5_000;
/*
 * Copy detection deliberately looks at shorter windows than the model is
 * asked to avoid. A lightly edited source sentence can break an exact
 * twelve-word match while still reading as the publisher's sentence; the
 * national CBP release on the test archive did exactly that. Seven-word
 * overlap catches that mosaic copying, while the ratio leaves room for one
 * isolated factual phrase (an agency unit, a date, a number) in otherwise
 * original prose.
 */
const COPY_SHINGLE_WORDS = 7;
const MAX_COPY_RUN_WORDS = 14;
const MAX_COPIED_RATIO = 0.25;
const MIN_ATTRIBUTED_DIGEST_WORDS = 30;
const MIN_ATTRIBUTED_DIGEST_SENTENCES = 2;
const MIN_DIGEST_WORDS_BEYOND_TITLE = 24;
const ATTRIBUTION_PATTERN =
  /\b(?:said|says|according to|reported|reports|announced|announces|stated|states|confirmed|confirms|testified|testifies|told|tells|argued|argues|claimed|claims|wrote|writes|noted|notes|described|describes|show|shows|showed)\b/i;

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

function sentenceCount(value: string) {
  const withoutAbbreviations = value
    .replace(
      /\b(?:U\.S\.(?:A\.)?|D\.C\.|Mr\.|Mrs\.|Ms\.|Dr\.|Gov\.|Sen\.|Rep\.|Inc\.|Corp\.|Co\.|No\.|vs\.|etc\.|e\.g\.|i\.e\.|a\.m\.|p\.m\.|Jan\.|Feb\.|Mar\.|Apr\.|Jun\.|Jul\.|Aug\.|Sep\.|Sept\.|Oct\.|Nov\.|Dec\.)/gi,
      (match) => match.replace(/\./g, '')
    )
    .replace(/\b(?:[A-Za-z]\.){2,}/g, (match) => match.replace(/\./g, ''));

  return withoutAbbreviations
    .split(/[.!?]+(?=\s|$)/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => digestWords(sentence).length >= 4).length;
}

/** A headline plus byline is not a digest, even when it passes the length floor. */
export function digestIsTitleOnly(title: string, digest: string) {
  const titleWords = digestWords(title);
  const digestWordList = digestWords(digest);
  if (titleWords.length < 3 || digestWordList.length === 0) return false;

  const digestSet = new Set(digestWordList);
  const matchedTitleWords = titleWords.filter((word) => digestSet.has(word)).length;
  const titleCoverage = matchedTitleWords / titleWords.length;
  const titleSet = new Set(titleWords);
  const wordsBeyondTitle = digestWordList.filter((word) => !titleSet.has(word)).length;

  return titleCoverage >= 0.8 && wordsBeyondTitle < MIN_DIGEST_WORDS_BEYOND_TITLE;
}

/** A digest must not contain an invented statistic, date or identifier. */
export function digestInventsNumber(source: string, digest: string) {
  const allowed = new Set(numberTokens(source));
  return numberTokens(digest).some((token) => !allowed.has(token));
}

/**
 * Measure how much of a digest reuses source wording. A short factual phrase
 * (an agency or unit name, a date, an operation description) is not
 * copy-paste; a digest assembled from source passages is. The longest covered
 * run and the share of covered words together distinguish the two.
 */
export function digestCopyProfile(source: string, digest: string) {
  const sourceWords = digestWords(source);
  const outputWords = digestWords(digest);
  if (outputWords.length < COPY_SHINGLE_WORDS) {
    return { longestRun: 0, copiedRatio: 0 };
  }

  const shingles = new Set<string>();
  for (let index = 0; index <= sourceWords.length - COPY_SHINGLE_WORDS; index += 1) {
    shingles.add(sourceWords.slice(index, index + COPY_SHINGLE_WORDS).join(' '));
  }
  if (shingles.size === 0) return { longestRun: 0, copiedRatio: 0 };

  const covered = new Array<boolean>(outputWords.length).fill(false);
  let copiedWords = 0;
  for (let index = 0; index <= outputWords.length - COPY_SHINGLE_WORDS; index += 1) {
    if (!shingles.has(outputWords.slice(index, index + COPY_SHINGLE_WORDS).join(' '))) {
      continue;
    }
    for (let offset = 0; offset < COPY_SHINGLE_WORDS; offset += 1) {
      const position = index + offset;
      if (!covered[position]) {
        covered[position] = true;
        copiedWords += 1;
      }
    }
  }

  let longestRun = 0;
  let currentRun = 0;
  for (const value of covered) {
    currentRun = value ? currentRun + 1 : 0;
    longestRun = Math.max(longestRun, currentRun);
  }

  return { longestRun, copiedRatio: copiedWords / outputWords.length };
}

/** Reject a digest built from source passages, allowing one short factual phrase. */
export function digestRepeatsSource(source: string, digest: string) {
  const profile = digestCopyProfile(source, digest);
  return profile.longestRun >= MAX_COPY_RUN_WORDS || profile.copiedRatio >= MAX_COPIED_RATIO;
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
 * A public discovery summary must be a real digest, not just the page's
 * headline and byline: at least two sentences, enough original prose to stand
 * on its own, a reporting attribution, no title-only output and no copied run.
 */
export function isAttributedSourceDigest(source: string, digest: string, title?: string | null) {
  if (!isSafeSourceDigest(source, digest)) return false;
  if (digestWords(digest).length < MIN_ATTRIBUTED_DIGEST_WORDS) return false;
  if (sentenceCount(digest) < MIN_ATTRIBUTED_DIGEST_SENTENCES) return false;
  if (title && digestIsTitleOnly(title, digest)) return false;
  return ATTRIBUTION_PATTERN.test(digest);
}
