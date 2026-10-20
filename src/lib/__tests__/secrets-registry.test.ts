// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SECRETS as CI_SECRETS, VARIABLES as CI_VARIABLES } from '../../../scripts/ci-env.mjs';
import {
  ALL_QUARANTINE_NAMES,
  EXPOSURE,
  OWNERS,
  QUARANTINE,
  REGISTRY,
  STORES,
} from '../../../scripts/secrets-registry.mjs';
import { ALL_VARS, CI_ONLY, SECRETS as VERCEL_SECRETS } from '../../../scripts/vercel-env.mjs';
import {
  ALL_NAMES as EDGE_NAMES,
  PLATFORM_INJECTED,
  PLATFORM_INJECTED_PLURAL,
  REQUIRED_IN_PROJECT,
} from '../../../supabase/functions/secrets.manifest.mjs';

/**
 * Contract tests for the secrets registry.
 *
 * The registry exists because the three declared manifests are all offline: they
 * prove a manifest agrees with the source, never that it agrees with a live
 * dashboard. A live audit on 2026-09-27 found production drift in every category
 * those gates claim to cover, and none of them could see it. These tests lock
 * down the properties that make the *registry* trustworthy, so the reconciler
 * built on top of it can be dumb and still correct.
 *
 * The recurring theme is a distinction that sounds pedantic and is not: a value
 * that is **unverifiable** must never be reported as **absent**. The bug that
 * produced the existing `supabase.yml` guard's own comment was a `grep` pattern
 * that silently matched nothing and reported every secret missing. Same shape, one
 * level up: a tool that reports an unauthenticated store as empty invites an
 * operator to "fix" a system that was never broken.
 */

describe('secrets registry: exposure classification', () => {
  it('classifies every NEXT_PUBLIC_* value as public', () => {
    // Next inlines these into the client bundle, so they are readable by every
    // visitor. Anything else is a credential published to the internet.
    for (const [name, meta] of Object.entries(REGISTRY)) {
      if (!name.startsWith('NEXT_PUBLIC_')) continue;
      expect(meta.exposure, `${name} is NEXT_PUBLIC_* but not classified public`).toBe(
        EXPOSURE.public
      );
    }
  });

  it('classifies every RLS-bypass key as privileged', () => {
    // Possession of these is possession of the database, not of a feature.
    for (const name of [
      'SUPABASE_SECRET_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_SECRET_KEYS',
    ]) {
      expect(REGISTRY[name]?.exposure, `${name} bypasses RLS`).toBe(EXPOSURE.privileged);
    }
  });

  it('uses only the four defined exposure levels', () => {
    const valid = new Set(Object.values(EXPOSURE));
    for (const [name, meta] of Object.entries(REGISTRY)) {
      expect(valid.has(meta.exposure), `${name} has unknown exposure '${meta.exposure}'`).toBe(
        true
      );
    }
  });
});

describe('secrets registry: ownership', () => {
  it('gives every registered secret a real owner', () => {
    for (const [name, meta] of Object.entries(REGISTRY)) {
      expect(meta.owner, `${name} has no owner`).toBeDefined();
      expect(meta.owner.id, `${name} resolves to the unowned placeholder`).not.toBe('unowned');
    }
  });

  it('gives every quarantined secret a real owner', () => {
    // An orphan credential is the finding this whole file exists to surface, so
    // it would be incoherent to then leave the orphans themselves unowned.
    for (const [name, meta] of Object.entries(QUARANTINE)) {
      expect(meta.owner, `${name} has no owner`).toBeDefined();
      expect(meta.owner.id).not.toBe('unowned');
    }
  });

  it('only references owners that exist', () => {
    const known = new Set(Object.values(OWNERS).map((o) => o.id));
    for (const [name, meta] of Object.entries(REGISTRY)) {
      expect(known.has(meta.owner.id), `${name} references unknown owner '${meta.owner.id}'`).toBe(
        true
      );
    }
  });
});

describe('secrets registry: store classification', () => {
  it('only lists stores the audit knows how to probe', () => {
    for (const [name, meta] of Object.entries(REGISTRY)) {
      for (const store of meta.stores) {
        expect(STORES[store], `${name} references unknown store '${store}'`).toBeDefined();
      }
    }
  });

  it('does not expect a public value in the secret half of a split store', () => {
    // Only meaningful where the platform actually splits public from private.
    // Supabase's edge store has a single bucket, so the rule does not apply
    // there — asserting it does would encode a falsehood about the platform.
    for (const [name, meta] of Object.entries(REGISTRY)) {
      if (meta.exposure !== EXPOSURE.public) continue;
      for (const store of meta.stores) {
        const def = STORES[store];
        expect(
          def.split && def.public === false,
          `${name} is public but expected in ${def.label}, which is a private store`
        ).toBeFalsy();
      }
    }
  });

  it('marks Supabase edge secrets as a single unsplit bucket', () => {
    // Regression guard on the reasoning itself: if this ever becomes `true`, the
    // public/private rule above silently starts firing on correct configuration.
    expect(STORES['edge-secret'].split).toBe(false);
    expect(STORES['edge-platform'].split).toBe(false);
    expect(STORES['github-secret'].split).toBe(true);
    expect(STORES['vercel-secret'].split).toBe(true);
  });
});

describe('secrets registry: covers every declared name', () => {
  const declared = [
    ...ALL_VARS,
    ...Object.keys(VERCEL_SECRETS),
    ...Object.keys(CI_VARIABLES),
    ...Object.keys(CI_SECRETS),
    ...EDGE_NAMES,
  ];

  it('registers or quarantines every name the manifests declare', () => {
    const known = new Set([...Object.keys(REGISTRY), ...ALL_QUARANTINE_NAMES]);
    const unowned = declared.filter((n) => !known.has(n) && n in CI_ONLY === false);
    expect(unowned, `declared but owned by nobody: ${unowned.join(', ')}`).toEqual([]);
  });

  it('justifies every registered name that no manifest declares', () => {
    // A registered-but-undeclared name is a gap: either a manifest has fallen
    // behind, or the registry is tracking a real value nobody has written down
    // anywhere. Both need to be a deliberate, recorded decision — the failure
    // mode this guards is the quiet one, where a credential is held in a store
    // and exists only in a script nobody reads.
    const declaredSet = new Set(declared);
    const strays = Object.keys(REGISTRY).filter(
      (n) => !declaredSet.has(n) && !(n in PLATFORM_INJECTED) && !(n in PLATFORM_INJECTED_PLURAL)
    );
    for (const name of strays) {
      expect(
        REGISTRY[name].registryOnly,
        `${name} is registered but declared in no manifest, with no justification. ` +
          `Either declare it in the owning manifest, or set \`registryOnly\` to say why not.`
      ).toBeTruthy();
    }
  });

  it('does not use registryOnly to excuse a name a manifest does declare', () => {
    // Otherwise the escape hatch swallows the gaps it exists to expose.
    const declaredSet = new Set(declared);
    for (const [name, meta] of Object.entries(REGISTRY)) {
      if (!meta.registryOnly) continue;
      expect(
        declaredSet.has(name) || name in PLATFORM_INJECTED || name in PLATFORM_INJECTED_PLURAL,
        `${name} is declared in a manifest, so registryOnly is a stale excuse`
      ).toBeFalsy();
    }
  });
});

describe('secrets registry: mustBeUnset is an assertion, not a comment', () => {
  it('marks WALLE_REFRESH_TOKEN as must-be-unset and expects no store', () => {
    // An unused alternate auth path into a service-role-key function. Listing it
    // with `stores: []` plus `mustBeUnset` turns "we checked and it is absent"
    // into something the audit can enforce, rather than a claim in a comment
    // that nobody re-reads.
    expect(REGISTRY.WALLE_REFRESH_TOKEN.mustBeUnset).toBe(true);
    expect(REGISTRY.WALLE_REFRESH_TOKEN.stores).toEqual([]);
    expect(REGISTRY.WALLE_REFRESH_TOKEN.exposure).toBe(EXPOSURE.privileged);
  });

  it('never marks a required secret as must-be-unset', () => {
    for (const name of REQUIRED_IN_PROJECT) {
      expect(REGISTRY[name]?.mustBeUnset, `${name} is both required and must-be-unset`).toBeFalsy();
    }
  });
});

describe('secrets registry: quarantine list', () => {
  it('treats an unread GITHUB_TOKEN in the edge store as critical', () => {
    // The single most actionable finding from the live audit: a GitHub
    // credential sitting in a store that four `--no-verify-jwt` functions share,
    // read by nothing.
    expect(QUARANTINE.GITHUB_TOKEN.severity).toBe('critical');
  });

  it('does not quarantine a name the registry already owns', () => {
    // Otherwise the same secret gets two verdicts and the reconciler has to pick.
    for (const name of ALL_QUARANTINE_NAMES) {
      expect(REGISTRY[name], `${name} is both registered and quarantined`).toBeUndefined();
    }
  });

  it('gives every quarantine entry an explanation', () => {
    for (const [name, meta] of Object.entries(QUARANTINE)) {
      expect(meta.why, `${name} has no explanation`).toBeTruthy();
    }
  });
});

describe('secrets manifests: platform-injected claim', () => {
  it('does not claim platform values are absent from `secrets list`', () => {
    // `secrets.manifest.mjs` and the supabase.yml comment both assert these are
    // "absent from `secrets list` by design". A live read on 2026-09-27 returned
    // SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY, plus the
    // plural _KEYS/_JWKS forms. The guard built on that claim is reasoning about
    // a store whose contents it has never observed.
    const source = PLATFORM_INJECTED;
    expect(Object.keys(source).length).toBeGreaterThan(0);
    for (const name of [...Object.keys(source), ...Object.keys(PLATFORM_INJECTED_PLURAL)]) {
      expect(
        REGISTRY[name]?.stores?.includes('edge-secret'),
        `${name} is platform-injected but the registry does not expect it in edge-secret`
      ).toBe(true);
    }
  });
});
