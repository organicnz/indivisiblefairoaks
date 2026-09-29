import { SECRETS as CI_SECRETS, VARIABLES as CI_VARIABLES } from './ci-env.mjs';
import {
  ALL_SECRETS as VERCEL_SECRETS,
  ALL_VARS as VERCEL_VAR_NAMES,
  CI_ONLY,
  SECRETS as VERCEL_SECRET_META,
  VARS as VERCEL_VARS,
} from './vercel-env.mjs';
import { QUARANTINE, REGISTRY, STORES } from './secrets-registry.mjs';
import {
  ALL_NAMES as EDGE_ALL,
  PLATFORM_INJECTED,
  REQUIRED_IN_PROJECT,
} from '../supabase/functions/secrets.manifest.mjs';

export const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export const REPEATS_ACROSS_STORES = new Set([
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'SUPABASE_SECRET_KEY',
]);

export function buildDeclared() {
  const d = new Map();
  const touch = (name, source, { required = false, store = null } = {}) => {
    if (!name) return;
    if (!d.has(name)) d.set(name, { sources: new Set(), required: false, stores: new Set() });
    const e = d.get(name);
    e.sources.add(source);
    e.required ||= required;
    if (store) e.stores.add(store);
  };

  for (const n of VERCEL_VAR_NAMES) {
    touch(n, 'vercel-env.mjs', { required: !!VERCEL_VARS[n]?.required, store: 'vercel-var' });
  }
  for (const n of VERCEL_SECRETS) {
    touch(n, 'vercel-env.mjs', { required: !!VERCEL_SECRET_META[n]?.required, store: 'vercel-secret' });
  }
  for (const n of Object.keys(CI_VARIABLES)) {
    touch(n, 'ci-env.mjs', { required: !!CI_VARIABLES[n].required, store: 'github-var' });
  }
  for (const n of Object.keys(CI_SECRETS)) {
    touch(n, 'ci-env.mjs', { required: !!CI_SECRETS[n].required, store: 'github-secret' });
  }
  for (const n of REQUIRED_IN_PROJECT) touch(n, 'secrets.manifest.mjs', { required: true, store: 'edge-secret' });
  for (const n of Object.keys(PLATFORM_INJECTED)) touch(n, 'secrets.manifest.mjs', { store: 'edge-platform' });
  for (const n of EDGE_ALL) {
    if (REGISTRY[n] && !REQUIRED_IN_PROJECT.includes(n)) touch(n, 'secrets.manifest.mjs', { store: 'edge-secret' });
  }
  return d;
}

/**
 * Compare the declared contract against what the live stores actually hold.
 *
 * @param {Map<string, {sources: Set<string>, required: boolean, stores: Set<string>}>} declared
 * @param {Map<string, {store: string, status: string, names: Set<string>|null}>} live
 *   `names: null` means the store was reachable but empty; a *missing* entry
 *   means the probe never ran, which `statusOf` reports as unreachable.
 * @param {{strict?: boolean, storeFilter?: string|null}} [options]
 *   `storeFilter` is a prefix match on the store name, so `--store vercel`
 *   scopes a run to every Vercel store at once.
 * @returns {Array<{severity: string, code: string, message: string, remediation: string, store?: string, name?: string}>}
 */
export function reconcile(declared, live, { strict = false, storeFilter = null } = {}) {
  const findings = [];
  const add = (severity, code, message, remediation, ctx = {}) =>
    findings.push({ severity, code, message, remediation, ...ctx });

  const nameByStore = (store) => live.get(store)?.names ?? null;
  const statusOf = (store) => live.get(store)?.status ?? 'unreachable';
  const inScope = (store) => !storeFilter || store.startsWith(storeFilter);
  const skipStore = (store) => !inScope(store) || statusOf(store) !== 'ok';

  for (const [store, r] of live) {
    if (!inScope(store)) continue;
    if (r.status === 'ok') continue;
    const sev = strict ? 'critical' : 'high';
    add(sev, 'store-unreachable',
      `${STORES[store]?.label ?? store} could not be read — status '${r.status}'` +
        (r.detail ? ` (${r.detail})` : ''),
      'Findings for this store are UNKNOWN, not clean. Authenticate and re-run; ' +
      'do not read the absence of findings here as an all-clear.' +
      (strict ? '' : ' Use --strict to make this fatal.'), { store });
  }

  for (const [name, d] of declared) {
    if (!d.required) continue;
    for (const store of d.stores) {
      if (skipStore(store)) continue;
      const names = nameByStore(store);
      if (names && !names.has(name)) {
        const meta = REGISTRY[name];
        add(meta?.exposure === 'privileged' ? 'critical' : 'high', 'required-missing',
          `${name} is declared required in ${[...d.sources].join(', ')} but is NOT set in ${STORES[store].label}` +
            (meta ? ` — exposure: ${meta.exposure}, owner: ${meta.owner.id}` : ''),
          remediationFor(store, name), { store, name });
      }
    }
  }

  for (const [name, meta] of Object.entries(REGISTRY)) {
    if (!meta.mustBeUnset) continue;
    for (const [store, r] of live) {
      if (!inScope(store)) continue;
      if (r.status !== 'ok' || !r.names?.has(name)) continue;
      add('critical', 'must-be-unset',
        `${name} is set in ${STORES[store].label} but nothing in this repository uses it`,
        `supabase secrets unset --project-ref <ref> ${name}`, { store, name });
    }
  }

  for (const [store, r] of live) {
    if (!inScope(store)) continue;
    if (r.status !== 'ok') continue;
    for (const name of r.names ?? []) {
      const meta = REGISTRY[name];
      if (QUARANTINE[name]) continue;
      if (!meta) continue;
      if (meta.mustBeUnset) continue;
      if (meta.stores.length === 0) continue;
      if (meta.stores.includes(store)) continue;
      if (store === 'local') continue;
      if (name.startsWith('NEXT_PUBLIC_') && STORES[store]?.split && STORES[store].public === false) continue;
      add('medium', 'misfiled',
        `${name} is in ${STORES[store].label} but the registry expects it in ${meta.stores.join(' or ')}` +
          (store === 'github-secret' ? ' — and it is a public value, so the store is also the wrong kind' : ''),
        store.endsWith('-secret') && meta.exposure === 'public'
          ? remediationFor(store.replace(/-secret$/, '-var'), name)
          : `Either add '${store}' to its registry entry, or move the value: ${remediationFor(store, name)}`, { store, name });
    }
  }

  for (const [store, r] of live) {
    if (!inScope(store)) continue;
    if (r.status !== 'ok') continue;
    for (const name of r.names ?? []) {
      if (!name.startsWith('NEXT_PUBLIC_')) continue;
      if (!STORES[store]?.split || STORES[store].public !== false) continue;
      add('critical', 'public-in-secret-store',
        `${name} is NEXT_PUBLIC_* (inlined into the client bundle) but is held in ${STORES[store].label}`,
        `Move it to the variables store. As a secret it is withheld from pull_request ` +
        `runs from forks, so a fork PR builds against empty config.`, { store, name });
    }
  }

  for (const [store, r] of live) {
    if (!inScope(store)) continue;
    if (r.status !== 'ok') continue;
    if (store === 'local') continue;
    for (const name of r.names ?? []) {
      if (REGISTRY[name] || declared.has(name) || name in PLATFORM_INJECTED) continue;
      const q = QUARANTINE[name];
      if (q) {
        add(q.severity === 'critical' ? 'critical' : q.severity, 'undeclared-live',
          `${name} is set in ${STORES[store].label}, is declared in no manifest, and is read by no code`,
          `${q.why}\n      Owner: ${q.owner.id}. Rotate, then remove:\n        supabase secrets unset --project-ref <ref> ${name}`, { store, name });
      } else {
        add('medium', 'undeclared-live',
          `${name} is set in ${STORES[store].label} but nothing in the repository claims it`,
          'Add it to REGISTRY with an owner and exposure, or remove it.', { store, name });
      }
    }
  }

  for (const [name, meta] of Object.entries(REGISTRY)) {
    if (meta.exposure !== 'privileged') continue;
    const present = [...live.entries()]
      .filter(([store, r]) => inScope(store) && r.status === 'ok' && r.names?.has(name) && meta.stores.includes(store))
      .map(([store]) => store);
    if (present.length > 1) {
      add('info', 'rotation-blast-radius',
        `${name} is privileged and set in ${present.length} stores: ${present.join(', ')}`,
        `Rotating it means changing it in all ${present.length}. ` +
        `(${REPEATS_ACROSS_STORES.has(name) ? 'Expected — independent runtimes each need their own copy.' : 'Not listed as an expected repeat; confirm this is intended.'})`);
    }
  }

  return findings;
}

export function auditRegistryConsistency(declared) {
  const findings = [];
  const add = (severity, code, message, remediation, ctx = {}) =>
    findings.push({ severity, code, message, remediation, ...ctx });

  for (const [name, meta] of Object.entries(REGISTRY)) {
    if (name.startsWith('NEXT_PUBLIC_') && meta.exposure !== 'public') {
      add('critical', 'exposure-mismatch',
        `${name} is NEXT_PUBLIC_* but classified '${meta.exposure}' in secrets-registry.mjs`,
        'Next inlines NEXT_PUBLIC_* into the client bundle. Classify it as public.');
    }
    if (!meta.owner || meta.owner.id === 'unowned') {
      add('high', 'no-owner', `${name} has no named owner`,
        'Assign an owner in scripts/secrets-registry.mjs. An unowned secret cannot be paged.');
    }
    if (declared.has(name) && !meta.owner) {
      add('high', 'unregistered', `${name} is declared in a manifest but not in the registry`,
        'Add it to REGISTRY so it has an owner and an expected store.');
    }
  }

  for (const [name, meta] of Object.entries(REGISTRY)) {
    if (meta.exposure !== 'public') continue;
    const wrong = meta.stores.filter((s) => STORES[s]?.split && STORES[s].public === false);
    if (wrong.length === 0) continue;
    add('critical', 'public-in-secret-store',
      `${name} is classified public but is expected in ${wrong.map((s) => STORES[s].label).join(' or ')}`,
      'A public value belongs in the Plain/Variables store. Held as a secret it is ' +
      'withheld from pull_request runs from forks, so a fork PR builds against empty config.', { name });
  }

  for (const name of declared.keys()) {
    if (REGISTRY[name] || QUARANTINE[name]) continue;
    if (CI_ONLY[name] || name === 'GITHUB_TOKEN') continue;
    add('medium', 'unregistered', `${name} is declared in a manifest but has no registry entry`,
      `Add it to REGISTRY in scripts/secrets-registry.mjs with an owner and exposure.`);
  }

  return findings;
}

export function parseVercelTable(stdout) {
  const out = { plain: [], secret: [], unknown: [] };
  for (const line of stdout.split('\n')) {
    const cols = line.trim().split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
    if (cols.length < 2) continue;
    const [name, ...rest] = cols;
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) continue;
    const type = rest.find((c) => /^(sensitive|non-sensitive|encrypted|plain)$/i.test(c)) ?? '';
    if (/^(sensitive|encrypted)$/i.test(type)) out.secret.push(name);
    else if (/^(non-sensitive|plain)$/i.test(type)) out.plain.push(name);
    else out.unknown.push(name);
  }
  return out;
}

export function remediationFor(store, name) {
  switch (store) {
    case 'edge-secret':
      return `supabase secrets set --project-ref <ref> ${name}=<value>` +
        `\n      (note: edge secrets are write-only — there is no API to read a value back)`;
    case 'github-secret':
      return `gh secret set ${name} --body <value>`;
    case 'github-var':
      return `gh variable set ${name} --body <value>`;
    case 'vercel-secret':
      return `vercel env add ${name} production --sensitive`;
    case 'vercel-var':
      return `vercel env add ${name} production`;
    default:
      return `set ${name} in ${STORES[store]?.label ?? store}`;
  }
}

export function fingerprint(f) {
  return `${f.code}:${f.store ?? '-'}:${f.name ?? '-'}`;
}

export function summarize(message, max = 120) {
  const firstClause = message.split(' — ')[0].replace(/\s+/g, ' ').trim();
  if (firstClause.length <= max) return firstClause;
  const cut = firstClause.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}
