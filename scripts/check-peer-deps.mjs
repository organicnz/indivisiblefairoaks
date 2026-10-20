#!/usr/bin/env bun
/**
 * Peer-dependency compatibility gate.
 *
 * Verifies that every peerDependency declared by the installed packages is
 * satisfied by the actually installed version. This catches the failure mode
 * an audit misses: a dependency update that is semver-compatible and free of
 * advisories can still declare a peer range (e.g. React 19.x) that the pinned
 * install does not satisfy — breaking the build at deploy time.
 *
 * Usage:
 *   bun scripts/check-peer-deps.mjs          # check production deps only
 *   bun scripts/check-peer-deps.mjs --all    # also check devDependencies
 *
 * Exit code 0 = all peer ranges satisfied, 1 = violations found.
 */
import { dirname, join } from 'node:path';

const ALL = process.argv.includes('--all');
const pkg = JSON.parse(
  await Bun.file(join(process.cwd(), 'package.json')).text()
);

const scopes = [pkg.dependencies || {}];
if (ALL) scopes.push(pkg.devDependencies || {});

async function resolveInstalled(name, fromDir) {
  if (fromDir) {
    try {
      // `Bun.resolveSync(specifier, parent)` resolves from `parent`'s tree,
      // which is what the `paths:` option of Node's `require.resolve` did.
      // Verified equivalent in the case that distinguishes them: scoped to
      // `tinyglobby`, both find the *nested* `picomatch`, and from the root
      // both find the hoisted one — so the answer this gate reads is the same
      // package either way.
      const res = Bun.resolveSync(`${name}/package.json`, fromDir);
      return JSON.parse(await Bun.file(res).text());
    } catch {
      /* not resolvable from that package's tree — fall through to root */
    }
  }
  try {
    const res = Bun.resolveSync(`${name}/package.json`, process.cwd());
    return JSON.parse(await Bun.file(res).text());
  } catch {
    return null;
  }
}

async function satisfiedBy(range, installedPkg) {
  if (!installedPkg) return false;
  if (range === '*' || range === 'latest' || installedPkg.version === 'latest') return true;

  const target = installedPkg.version.split('-')[0];
  const supported = (r) => r.replace(/\s+/g, '').replace(/^(v|=)/, '');
  const toParts = (v) => v.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const compare = (a, b) => {
    const pa = toParts(a);
    const pb = toParts(b);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
    }
    return 0;
  };

  for (const clause of range.split('||')) {
    const rawTokens = clause.trim().split(/\s+/).filter(Boolean);
    // Reattach operators separated from their version by whitespace
    // (e.g. ">= 1.0.0" arrives as [">=", "1.0.0"]).
    const ranges = [];
    for (let i = 0; i < rawTokens.length; i++) {
      if (/^(<=|>=|<|>|\^|~)$/.test(rawTokens[i])) {
        ranges.push(rawTokens[i] + (rawTokens[i + 1] ?? ''));
        i++;
      } else {
        ranges.push(rawTokens[i]);
      }
    }
    let ok = true;
    for (const bound of ranges) {
      const m = bound.match(/^(<=|>=|<|>|\^|~)?(\d+)\.(\d+)(\.(\d+))?$/);
      if (!m) {
        // exotic range (e.g. workspace:* or a URL) — treat as satisfied, the
        // install itself resolved it, so the resolver accepted it.
        continue;
      }
      const [, op, maj, min, , patch] = m;
      const base = [maj, min, patch || '0'].join('.');
      const current = toParts(target);

      if (op === '^') {
        if (current[0] !== Number(maj)) ok = false;
        else if (current[0] === 0 && current[1] !== Number(min)) ok = false;
        else if (compare(target, base) < 0) ok = false;
      } else if (op === '~') {
        if (current[0] !== Number(maj) || current[1] !== Number(min)) ok = false;
        else if (compare(target, base) < 0) ok = false;
      } else if (op === '>=' || op === '>' || op === '<' || op === '<=') {
        const c = compare(target, base);
        if (op === '>=' && c < 0) ok = false;
        if (op === '>' && c <= 0) ok = false;
        if (op === '<' && c >= 0) ok = false;
        if (op === '<=' && c > 0) ok = false;
      } else {
        // exact or bare version
        if (compare(target, base) !== 0) ok = false;
      }
    }
    if (ok) return true;
  }
  return false;
}

const violations = [];
const checked = new Set();

for (const [name] of Object.entries(Object.assign({}, ...scopes))) {
  const rootPkg = await resolveInstalled(name);
  if (!rootPkg) {
    violations.push(`  ${name}: package not installed (run bun install)`);
    continue;
  }
  for (const [depName, range] of Object.entries(rootPkg.peerDependencies || {})) {
    const optional =
      rootPkg.peerDependenciesMeta?.[depName]?.optional === true;
    const key = `${name}→${depName}`;
    if (checked.has(key)) continue;
    checked.add(key);

    // The peer's own tree is the scope its peer range must be satisfied
    // within, so the package's own directory is what `fromDir` has to be.
    let peerScope = process.cwd();
    try {
      peerScope = dirname(Bun.resolveSync(`${name}/package.json`, process.cwd()));
    } catch {
      // The package itself is not installed — `resolveInstalled` will report
      // that as "not installed" for the peer, which is the honest answer.
    }

    const depPkg = await resolveInstalled(depName, peerScope);
    const ok = await satisfiedBy(String(range), depPkg);
    if (!ok && !optional) {
      violations.push(
        `  ${name} (v${rootPkg.version}) requires ${depName}@${range}, ` +
          (depPkg ? `found v${depPkg.version}` : 'but it is not installed')
      );
    }
  }
}

if (violations.length > 0) {
  console.error('❌ Peer-dependency violations:');
  for (const v of violations) console.error(v);
  console.error('');
  console.error('   A compatible version must be pinned before deploying.');
  process.exit(1);
}

const scope = ALL ? 'all' : 'production';
console.log(`✅ Peer dependencies satisfied (${scope}) — ${checked.size} relationships checked`);