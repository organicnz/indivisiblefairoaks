#!/usr/bin/env bun
/**
 * Secret scrubber for captured logs.
 *
 * Build logs can echo credential *values* — a token printed by a verbose
 * build step, a key embedded in a URL. GitHub's `::add-mask::` covers the
 * workflow log but NOT artifact bytes, so anything persisted or sent onward
 * (an uploaded log, a future AI-review feed) must be scrubbed explicitly.
 *
 * Two layers, in this order:
 *
 *   1. Known values — secret values already present in the job's environment
 *      (currently just `VERCEL_TOKEN`). Exact match via split/join, never a
 *      regex, so a value containing regex syntax cannot break the scrub.
 *      Values shorter than 8 characters are skipped: scrubbing those would
 *      nuke ordinary words that happen to match.
 *   2. Shape patterns — token formats recognisable without knowing the value
 *      (Stripe keys, GitHub tokens, `Bearer` headers, PEM blocks).
 *
 * What this deliberately does NOT promise: a secret value the job never held
 * and whose shape matches no pattern passes through. That residual risk is
 * why the capture plan documents it instead of claiming zero-leak. The
 * mitigation for it is structural — the poll job holds almost no secrets —
 * not a longer regex list.
 *
 * Total by contract: never throws, on any input. A scrubber that throws on
 * hostile bytes is a scrubber that gets bypassed, so non-strings yield `''`
 * and every replacement is linear-time (no nested quantifiers anywhere).
 *
 * @param {unknown} text
 * @param {unknown[]} [values]
 * @returns {string}
 */
const PATTERNS = [
  /sk_(live|test)_[A-Za-z0-9]+/g,
  /gh[pousr]_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /Bearer\s+[A-Za-z0-9\-._~+/=]{8,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export function scrubSecrets(text, values = []) {
  if (typeof text !== 'string') return '';
  let out = text;
  for (const v of values) {
    if (typeof v !== 'string' || v.length < 8) continue;
    out = out.split(v).join('[REDACTED]');
  }
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, '[REDACTED]');
  }
  return out;
}
