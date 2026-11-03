#!/usr/bin/env bun
/**
 * DMARC hosted-config assertion.
 *
 * `rua=` on the hosted `_dmarc` record decides where every receiver on the
 * internet sends aggregate reports for this domain. It is not readable from
 * the repository and no offline guard can see it, so it is exactly the kind of
 * hosted state that rots unnoticed — which is how it came to point at a
 * personal mailbox for weeks while the documentation said telemetry was
 * "monitoring only" and nobody was reading it. Issue #161 cut it over to
 * Cloudflare DMARC Management (2026-11-02); this guard is what notices if it
 * ever drifts back.
 *
 * DNS is public, so unlike the other live reconcilers this needs **no
 * credential of any kind**. Nothing is scoped, nothing is secret, and the
 * worst case of a leak is the zone's DMARC policy, which any resolver can
 * already read.
 *
 * Both DoH endpoints are queried and must agree. A disagreement is a finding,
 * not a tie to break quietly: either the record changed seconds ago and TTL
 * propagation is mid-flight (re-run in five minutes; if it persists, one of
 * the resolvers is lying and that is a finding in itself), or the two paths
 * genuinely diverge, which is exactly the state an attacker wants.
 *
 * UNKNOWN is never "clean": if neither endpoint answers, the result is
 * UNKNOWN and exits 0 — a network outage is not a defect in this repository.
 * `--strict` (used by the nightly workflow) turns UNKNOWN into exit 1.
 *
 * Usage:
 *   bun scripts/check-dmarc.mjs [--strict]
 * Exit 0 = clean or UNKNOWN (without --strict), 1 = a finding.
 *
 * `DMARC_CHECK_DOMAIN` overrides the apex for local probing (it exists so the
 * failure paths can be exercised for real, e.g.
 * `DMARC_CHECK_DOMAIN=example.com bun scripts/check-dmarc.mjs`). The pinned
 * collector is NOT domain-conditional — do not use this to "test" another
 * property.
 */

const DOMAIN = Bun.env.DMARC_CHECK_DOMAIN || 'indivisiblefairoaks.org';
const DMARC_NAME = `_dmarc.${DOMAIN}`;

/** The collector the rua was cut over to in #161. Changing it must be a conscious edit here. */
const PINNED_COLLECTOR = 'dmarc-reports.cloudflare.net';
/** The mailbox retired in #161. Its reappearance anywhere in the record is a finding. */
const RETIRED_MAILBOX = 'tamerlanium@gmail.com';
/** Enforcement below this is not enforcement. `p=none` must never come back silently. */
const ENFORCED = new Set(['quarantine', 'reject']);
/** Mailbox providers whose appearance in `ruf=` makes it (almost certainly) someone's inbox, not a processor. */
const PERSONAL_PROVIDERS = /(@|\.)(gmail|googlemail|outlook|hotmail|yahoo|icloud)\.com/i;

const STRICT = process.argv.includes('--strict');
const DOH = [
  { name: 'dns.google', url: (n) => `https://dns.google/resolve?name=${encodeURIComponent(n)}&type=TXT` },
  { name: 'cloudflare-dns.com', url: (n) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(n)}&type=TXT` },
];
const FETCH_TIMEOUT_MS = 6000;

let findings = [];
const ok = (msg) => console.log(`  OK    ${msg}`);
const note = (msg) => console.log(`  WARN  ${msg}`);
const fail = (msg) => { findings.push(msg); console.log(`  FAIL  ${msg}`); };

/** `"chunk1" "chunk2"` → `chunk1chunk2`; bare strings pass through trimmed. */
function unquoteTxt(data) {
  const chunks = [...String(data).matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\(.)/g, '$1'));
  return chunks.length ? chunks.join('') : String(data).trim().replace(/^"|"$/g, '');
}

async function queryDoh({ name, url }) {
  const res = await fetch(url(DMARC_NAME), {
    headers: { accept: 'application/dns-json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const json = await res.json();
  const records = [];
  for (const answer of json.Answer ?? []) {
    if (answer.type === 16) records.push(unquoteTxt(answer.data)); // TXT
  }
  return { name, status: json.Status, records };
}

/** TXT records that are DMARC policies (a domain may publish other TXT records alongside). */
const asDmarc = (records) => records.filter((r) => /^v=DMARC1\s*;/i.test(r.trim()));

/** `v=DMARC1; p=quarantine; rua=a,b; ...` → sorted { tag: value } with duplicates kept as last-wins (invalid records fail downstream checks). */
function parseTags(record) {
  const tags = new Map();
  for (const part of record.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    if (key) tags.set(key, value);
  }
  return tags;
}

/** Recursively render a finding if the two resolvers disagree about the record. */
function compareResolverAnswers(results) {
  const seen = new Map();
  for (const r of results) {
    const key = [...asDmarc(r.records)].map((s) => s.replace(/\s+/g, ' ').trim()).sort().join('|');
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(r.name);
  }
  if (seen.size > 1) {
    for (const [value, resolvers] of seen) {
      console.log(`  ${resolvers.join(' + ')} sees: ${value || '(no DMARC TXT)'}`);
    }
    fail('DoH resolvers disagree about the DMARC record — change in flight or one resolver is wrong; re-check, then investigate');
  }
}

console.log(`[check-dmarc] ${DMARC_NAME} via DNS-over-HTTPS`);

const settled = await Promise.allSettled(DOH.map(queryDoh));
const answered = [];
const unreachable = [];
for (let i = 0; i < DOH.length; i++) {
  const r = settled[i];
  if (r.status === 'fulfilled') answered.push(r.value);
  else unreachable.push(`${DOH[i].name} (${r.reason?.message ?? r.reason})`);
}

if (answered.length === 0) {
  console.log(`  UNKNOWN neither DoH endpoint answered: ${unreachable.join('; ')}`);
  console.log(`  No resolver, no verification — this is not a pass. Re-run, or investigate network egress.`);
  process.exit(STRICT ? 1 : 0);
}

if (unreachable.length > 0) {
  note(`single-source answer (unreachable: ${unreachable.join('; ')}) — proceeding on the resolver that answered`);
}

compareResolverAnswers(answered);

// Assert on every resolver that answered; a finding from any of them is a finding.
for (const result of answered) {
  const prefix = answered.length > 1 ? `[${result.name}] ` : '';
  const dmarc = asDmarc(result.records);

  if (result.status === 3) {
    fail(`${prefix}NXDOMAIN for ${DMARC_NAME} — the DMARC record is gone`);
    continue;
  }
  if (dmarc.length === 0) {
    fail(`${prefix}no DMARC record published at ${DMARC_NAME}`);
    continue;
  }
  if (dmarc.length > 1) {
    fail(`${prefix}${dmarc.length} DMARC records published — receivers must see exactly one`);
    continue;
  }

  const record = dmarc[0];
  const tags = parseTags(record);
  ok(`${prefix}DMARC present: ${record.replace(/\s+/g, ' ').trim()}`);

  const p = (tags.get('p') ?? '').toLowerCase();
  if (ENFORCED.has(p)) ok(`${prefix}p=${p} — enforcement is on`);
  else fail(`${prefix}p=${p || '(missing)'} — enforcement is off; expected quarantine or reject`);

  const sp = (tags.get('sp') ?? '').toLowerCase();
  if (tags.has('sp') && !ENFORCED.has(sp)) fail(`${prefix}sp=${sp} — subdomain policy is not enforced`);
  else if (tags.has('sp')) ok(`${prefix}sp=${sp}`);
  else note(`${prefix}no sp= tag — subdomains inherit p=`);

  const pct = tags.get('pct');
  if (pct !== undefined && pct !== '100') fail(`${prefix}pct=${pct} — enforcement is partial; expected 100`);
  else if (pct === '100') ok(`${prefix}pct=100`);

  const rua = tags.get('rua') ?? '';
  if (!rua) {
    fail(`${prefix}no rua= tag — aggregate reports go nowhere`);
  } else {
    const lower = rua.toLowerCase();
    if (lower.includes(RETIRED_MAILBOX)) fail(`${prefix}rua names the retired personal mailbox (${RETIRED_MAILBOX})`);
    else if (!lower.includes(PINNED_COLLECTOR)) fail(`${prefix}rua does not point at the pinned collector (${PINNED_COLLECTOR}): ${rua} — if this change was deliberate, update PINNED_COLLECTOR in scripts/check-dmarc.mjs`);
    else ok(`${prefix}rua → ${PINNED_COLLECTOR}`);
  }

  const ruf = tags.get('ruf');
  if (ruf !== undefined) {
    if (PERSONAL_PROVIDERS.test(ruf)) fail(`${prefix}ruf sends failure reports to a personal mailbox: ${ruf}`);
    else note(`${prefix}ruf=${ruf} present — failure reports requested; confirm the recipient is intentional`);
  }

  // Alignment: relaxed is required for Google Workspace (SPF envelope-from is google.com).
  const aspf = (tags.get('aspf') ?? 'r').toLowerCase();
  const adkim = (tags.get('adkim') ?? 'r').toLowerCase();
  if (aspf !== 'r') fail(`${prefix}aspf=${aspf} — strict SPF alignment will fail Google Workspace mail (envelope-from is google.com)`);
  else if (aspf === 'r') ok(`${prefix}aspf=r`);
  if (adkim !== 'r') note(`${prefix}adkim=${adkim} — strict DKIM alignment; only safe while every sender signs d=indivisiblefairoaks.org`);
}

if (findings.length > 0) {
  console.log(`\n[check-dmarc] ${findings.length} finding(s). The hosted _dmarc policy no longer matches the pinned contract.`);
  console.log('[check-dmarc] If every flagged change was deliberate, update the pins at the top of scripts/check-dmarc.mjs — do not silence this check.');
  process.exit(1);
}
console.log('\n[check-dmarc] Clean.');
process.exit(0);
