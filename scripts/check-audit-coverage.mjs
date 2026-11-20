#!/usr/bin/env bun
/**
 * Static audit-coverage guard.
 *
 * `recordAdminAudit` is only useful if the privileged paths actually call it.
 * Nothing enforced that: a new admin write could ship without an audit entry,
 * and the only way to notice was to remember to look. This guard makes the
 * decision explicit and visible at commit time.
 *
 * ## What counts as a privileged surface
 *
 * Every TypeScript file under `src/app/api/` or `src/lib/actions/` that performs
 * a PostgREST write (`.insert`, `.update`, `.delete`, `.upsert`) or calls a
 * database function (`.rpc`). Those are the server surfaces that can change
 * data. A file that calls `recordAdminAudit` or the CRM wrapper
 * `recordCRMAudit` is covered.
 *
 * ## The baseline is a ratchet
 *
 * Existing gaps are listed in `AUDIT_EXEMPTIONS` with a reason, so the guard can
 * be blocking today without pretending the gaps are fixed. An exemption is only
 * valid while it is still true: if the file gains an audit call, stops writing,
 * or is deleted, the guard fails and the entry must be removed. That means the
 * list can only shrink.
 *
 * A new write-capable file with no audit call fails immediately. That is the
 * whole point: the decision to leave a path unaudited has to be written down
 * and reviewed, not inherited by accident.
 *
 * ## False positives are the safe direction
 *
 * Write detection is textual, so a comment or a string containing `.update(`
 * counts as a write. That over-reports, which asks for an exemption; it never
 * silently under-reports a real write. The reverse trade would let a missing
 * audit call pass unseen, which is the failure this exists to prevent.
 */
import path from 'node:path';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const ROOTS = ['src/app/api', 'src/lib/actions'];

/**
 * Files that may mutate without an audit call, and why.
 *
 * Keep each reason specific. "Public" is not enough — say what authorizes the
 * mutation. "Known gap" is honest: it records a real coverage hole that should
 * be fixed, while the guard stops new ones appearing.
 */
export const AUDIT_EXEMPTIONS = new Map([
  // Public endpoints authorized by a per-contact token, not an admin session.
  [
    'src/app/api/crm/unsubscribe/route.ts',
    'public one-click unsubscribe; the contact token authorizes the write and crm_activities records it',
  ],
  [
    'src/app/api/newsletter/confirm/route.ts',
    'public double-opt-in confirmation; the contact token authorizes the write',
  ],
  // Signed provider callback, not a user request.
  [
    'src/app/api/webhooks/resend/route.ts',
    'signature-verified Resend webhook; it records crm_email_events and crm_activities',
  ],
  // Not admin mutations: the actor is changing their own account.
  [
    'src/lib/actions/mfa-recovery.ts',
    'self-service MFA recovery; operates on the signed-in user’s own factors',
  ],
  [
    'src/lib/actions/settings.ts',
    'signed-in user’s own settings; not an administrative mutation',
  ],
  // Read-only, but the aggregate is reached through `.rpc`, which the write
  // detector cannot distinguish from a mutating function.
  ['src/lib/actions/crm/stats.ts', 'read-only aggregate RPC; no rows change'],
]);

/** Strip comments so prose about a write does not register as one. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

export function isWriteCapable(source) {
  return /\.(insert|update|delete|upsert|rpc)\s*\(/.test(stripComments(source));
}

export function hasAuditCall(source) {
  // `recordCRMAudit` is the CRM wrapper around `recordAdminAudit`; matching only
  // the direct name would report every CRM module as a gap.
  return /\brecord(?:Admin|CRM)Audit\s*\(/.test(stripComments(source));
}

/**
 * @param {{ files: { path: string, source: string }[], exemptions?: Map<string, string> }} input
 * @returns {{ unclassified: string[], staleExemptions: string[], missingReasons: string[] }}
 */
export function classifyAuditCoverage({ files, exemptions = AUDIT_EXEMPTIONS }) {
  const byPath = new Map(files.map((file) => [file.path, file.source]));
  const unclassified = [];
  const staleExemptions = [];
  const missingReasons = [];

  for (const file of files) {
    if (!isWriteCapable(file.source)) continue;
    if (hasAuditCall(file.source)) continue;
    if (!exemptions.has(file.path)) unclassified.push(file.path);
  }

  for (const [file, reason] of exemptions) {
    if (!reason.trim()) missingReasons.push(file);
    const source = byPath.get(file);
    if (source === undefined) {
      staleExemptions.push(`${file} — exempted file no longer exists`);
      continue;
    }
    if (hasAuditCall(source)) {
      staleExemptions.push(`${file} — now calls an audit recorder; remove the exemption`);
      continue;
    }
    if (!isWriteCapable(source)) {
      staleExemptions.push(`${file} — no longer performs a write; remove the exemption`);
    }
  }

  return {
    unclassified: unclassified.sort(),
    staleExemptions: staleExemptions.sort(),
    missingReasons: missingReasons.sort(),
  };
}

function findingCount(findings) {
  return Object.values(findings).reduce((total, values) => total + values.length, 0);
}

async function readServerSources(root) {
  const files = [];
  for (const relativeRoot of ROOTS) {
    const glob = new Bun.Glob('**/*.ts');
    for await (const name of glob.scan({ cwd: path.join(root, relativeRoot) })) {
      if (name.includes('__tests__') || /\.(?:test|spec)\.ts$/.test(name)) continue;
      const filePath = path.posix.join(relativeRoot, name);
      files.push({
        path: filePath,
        source: await Bun.file(path.join(root, relativeRoot, name)).text(),
      });
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * @param {object} [options]
 * @param {string} [options.root]
 * @param {Map<string, string>} [options.exemptions]
 * @param {(message: string) => void} [options.log]
 * @param {(message: string) => void} [options.error]
 * @returns {Promise<number>} Process exit code.
 */
export async function main({
  root = PROJECT_ROOT,
  exemptions = AUDIT_EXEMPTIONS,
  log = console.log,
  error = console.error,
} = {}) {
  try {
    const files = await readServerSources(root);
    const findings = classifyAuditCoverage({ files, exemptions });
    const total = findingCount(findings);
    const writeFiles = files.filter((file) => isWriteCapable(file.source)).length;

    if (total === 0) {
      log(
        `✔  Audit coverage: ${writeFiles} write-capable server files are audited or explicitly exempt.`
      );
      return 0;
    }

    error('');
    error(`✖  Audit coverage: ${total} finding${total === 1 ? '' : 's'}.`);
    const groups = [
      ['Write-capable files with no audit call and no exemption:', findings.unclassified],
      ['Exemptions that no longer describe the code:', findings.staleExemptions],
      ['Exemptions with no reason:', findings.missingReasons],
    ];
    for (const [label, values] of groups) {
      if (values.length === 0) continue;
      error(`  ${label}`);
      for (const value of values) error(`    ${value}`);
    }
    error('');
    error('  Call recordAdminAudit (or recordCRMAudit in the CRM modules), or add');
    error('  the file to AUDIT_EXEMPTIONS in scripts/check-audit-coverage.mjs with');
    error('  a reason that says what authorizes the write.');
    return 1;
  } catch (cause) {
    error(`✖  Audit coverage guard could not run: ${cause.message}`);
    error('   This is a check failure, not a clean result.');
    return 1;
  }
}

if (process.argv[1]?.endsWith('check-audit-coverage.mjs')) {
  process.exit(await main());
}
