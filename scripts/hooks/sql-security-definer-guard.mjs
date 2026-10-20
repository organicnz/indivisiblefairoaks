#!/usr/bin/env bun
/**
 * SQL: SECURITY DEFINER must pin `search_path` to the empty string.
 *
 * A SECURITY DEFINER function whose search_path can be influenced is
 * exploitable: a caller who can create an object earlier on the path can have the
 * function resolve *their* object instead of the intended relation.
 * https://www.postgresql.org/docs/current/sql-createfunction.html#id-1.9.3.67.7
 *
 * ## Why `= ''` and not merely "has a SET search_path"
 *
 * This guard previously accepted any value. `SET search_path = public` therefore
 * passed it, and three functions in 20260922200000_crm_realtime_triggers.sql were
 * written that way — the only privileged functions in this schema not pinned to
 * the empty string, in a migration whose own header (20260929120000) calls out the
 * difference between the two.
 *
 * That mattered here specifically. `public` is writable by `anon`, and the
 * trigger fires on rows an anonymous visitor can reach: the contact form's
 * `submit_contact_submission` RPC is `SECURITY DEFINER`, granted to `anon`, and
 * its owner-privileged insert is what fires `fn_sync_contact_submission_to_crm()`.
 * So the function ran, on the public internet, with the table owner's
 * privileges and RLS bypassed — and a search_path whose first schema an
 * anonymous visitor can write to. (An earlier version of this header named a
 * `WITH CHECK (true)` INSERT policy for `anon` as the mechanism; that policy
 * was dropped at 20260922050000 and never recreated. The conclusion was right;
 * the stated mechanism was stale, and a stated mechanism is what the next reader
 * treats as fact.)
 *
 * `SET search_path = ''` closes it: with an empty path an unqualified name
 * resolves nowhere and raises, rather than silently binding to something an
 * attacker controls. Failing loudly is the point — a migration that breaks a
 * trigger is visible in staging, a hijacked one is not visible anywhere.
 *
 * `SET search_path = ''` is only correct alongside fully-qualified relation names,
 * so this guard also reports functions whose bodies reference `crm_contacts` (or
 * any other known table) without the `public.` prefix. That pairing is the whole
 * contract; either half alone is a trap.
 */

const UPDATE_BASELINE = process.argv.includes('--update-baseline');
const BASELINE_PATH = 'scripts/sql-guard-baseline.json';

let baseline = { $comment: '', accepted: {} };
try {
  baseline = JSON.parse(await Bun.file(BASELINE_PATH).text());
} catch {
  // Non-fatal: first run or the file has been removed, start empty.
}

const accepted = new Set(Object.keys(baseline.accepted ?? {}));

const files = process.argv.slice(2);
const unpinned = [];
const notQualified = [];

for (const file of files) {
  let content;
  try {
    content = await Bun.file(file).text();
  } catch {
    continue;
  }

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('SECURITY DEFINER')) continue;
    // A line comment explaining why the pin matters mentions the phrase, and
    // treating it as a declaration would report a finding whose "function" is a
    // paragraph — and then look for its body in the next `AS $$`.
    if (lines[i].trimStart().startsWith('--')) continue;

    const start = Math.max(0, i - 5);
    const end = Math.min(lines.length, i + 11);
    const context = lines.slice(start, end).join('\n');

    // The *value*, not the presence. `SET search_path = public` is the exact
    // mistake this file exists to catch, so matching on the keyword alone would
    // have let it through.
    if (!/SET\s+search_path\s*=\s*''/i.test(context)) {
      const declared = /SET\s+search_path\s*=\s*([^\s;]+)/i.exec(context);
      unpinned.push(
        `  ${file}:${i + 1}${declared ? `  (declares = ${declared[1]})` : '  (no SET at all)'}`
      );
      // A missing pin is already the finding; do not also report the body's
      // qualification, which is a consequence of it and would double every line.
      continue;
    }

    // With the path pinned to '', an unqualified relation name raises at runtime.
    // The function body follows the `AS $$` that this window reaches, so look
    // ahead rather than only at the declaration.
    const bodyStart = content.indexOf('AS $$', i);
    if (bodyStart === -1) continue;
    const bodyEnd = content.indexOf('$$;', bodyStart);
    if (bodyEnd === -1) continue;
    const body = content.slice(bodyStart, bodyEnd).replace(/--[^\n]*/g, '');

    const bare = body.match(
      /(?<!public\.)\b(crm_contacts|crm_activities|crm_broadcasts|crm_segments|crm_tasks|contact_submissions|profiles|content|content_revisions|orders|products)\b/g
    );
    if (bare) {
      notQualified.push(`  ${file}:${i + 1}  (unqualified: ${[...new Set(bare)].join(', ')})`);
    }
  }
}

if (unpinned.length > 0 || notQualified.length > 0) {
  // Fingerprint by the same "what is wrong" as `--update-baseline` writes. The
  // fingerprint is `file:line` because that is the unit a human fixes: a
  // corrected declaration makes the finding disappear, a moved declaration
  // re-enters the baseline as new. The secrets baseline uses `code:store:name`;
  // this guard has no such natural triplet, so the line number is the ID.
  const findings = [];
  for (const u of unpinned) findings.push({ id: u.trim().split('  ')[0], kind: 'unpinned', detail: u.trim() });
  for (const n of notQualified) findings.push({ id: n.trim().split('  ')[0], kind: 'unqualified', detail: n.trim() });

  const newFindings = findings.filter((f) => !accepted.has(f.id));
  const knownFindings = findings.filter((f) => accepted.has(f.id));

  if (UPDATE_BASELINE) {
    const acceptedObj = {};
    for (const f of findings) {
      acceptedObj[f.id] = { severity: f.kind === 'unpinned' ? 'critical' : 'high', summary: f.detail };
    }
    await Bun.write(
      BASELINE_PATH,
      JSON.stringify({ $comment: 'Accepted SECURITY DEFINER guard findings. Each entry records that a human reviewed it. Regenerate with: bun scripts/hooks/sql-security-definer-guard.mjs --update-baseline', updated: new Date().toISOString().slice(0, 10), accepted: acceptedObj }, null, 2) + '\n'
    );
    console.log(`✔ Baseline updated — ${findings.length} findings (${newFindings.length} new, ${knownFindings.length} re-accepted) written to ${BASELINE_PATH}`);
    process.exit(0);
  }

  /*
   * Baseline-.staleness is a split: a known finding that is no longer visible —
   * because the declaration was fixed, the line moved, or the file was renamed —
   * is reported. It does NOT fail: the goal is that fewer findings is always
   * fine. Failing on a stale baseline would punish a fix. But a *new* finding
   * fails, because that is what the guard exists for.
   */
  const currentIds = new Set(findings.map((f) => f.id));
  const stale = [...accepted].filter((id) => !currentIds.has(id));
  if (stale.length > 0) {
    console.log(`ℹ  ${stale.length} baseline entries no longer match a finding:`);
    for (const s of stale) console.log(`  ${s}`);
    console.log('   Regenerate the baseline to drop them: --update-baseline');
    console.log('');
  }

  if (knownFindings.length > 0) {
    console.log(`ℹ  ${knownFindings.length} known findings (accepted in baseline):`);
    for (const k of knownFindings) console.log(`  ${k.detail}`);
    console.log('');
  }

  if (newFindings.length > 0) {
    console.log('');
    const unpinnedNew = newFindings.filter((f) => f.kind === 'unpinned');
    const unqualifiedNew = newFindings.filter((f) => f.kind === 'unqualified');
    if (unpinnedNew.length > 0) {
      console.log(`✖  SECURITY DEFINER without SET search_path = '' (${unpinnedNew.length}):`);
      for (const f of unpinnedNew) console.log(f.detail);
      console.log('');
      console.log("   Add SET search_path = '' to the function definition:");
      console.log("   LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';");
      console.log('');
      console.log("   `SET search_path = public` does NOT satisfy this. A writable");
      console.log("   schema on the path is the hijack this guard exists to prevent.");
      console.log('');
    }
    if (unqualifiedNew.length > 0) {
      console.log(`✖  SECURITY DEFINER with an empty search_path but unqualified relations (${unqualifiedNew.length}):`);
      for (const f of unqualifiedNew) console.log(f.detail);
      console.log('');
      console.log('   With SET search_path = \'\' an unqualified name resolves nowhere');
      console.log("   and raises at runtime. Qualify every relation: public.crm_contacts.");
      console.log('');
    }
    process.exit(1);
  }
}
