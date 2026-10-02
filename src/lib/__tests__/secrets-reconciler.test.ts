import { describe, expect, it } from 'vitest';
import {
  auditRegistryConsistency,
  buildDeclared,
  fingerprint,
  parseVercelTable,
  reconcile,
  remediationFor,
  summarize,
} from '../../../scripts/secrets-reconciler.mjs';
import { REGISTRY } from '../../../scripts/secrets-registry.mjs';

/**
 * Assert a finding exists and return it. Throwing beats `expect(x).toBeDefined()`
 * followed by dereferencing, because the control flow then carries the
 * non-null type — a missing finding fails at this line with the predicate
 * visible, instead of as a TypeError three assertions later.
 */
/**
 * Assert a finding exists and return it. Throwing beats `expect(x).toBeDefined()`
 * followed by dereferencing, because the control flow then carries the
 * non-null type — a missing finding fails at this line with the predicate
 * visible, instead of as a TypeError three assertions later.
 */
function mustFind<T extends { code: string }>(findings: T[], code: string): T {
  const found = findings.find((f) => f.code === code);
  if (!found) {
    throw new Error(
      `expected a "${code}" finding, got: ${findings.map((f) => f.code).join(', ') || 'none'}`
    );
  }
  return found;
}

/** @param {Array<[string, string, string[]|null]>} entries */
function makeLive(entries: Array<[string, string, string[] | null]>) {
  const map = new Map();
  for (const [store, status, names] of entries) {
    map.set(store, { store, status, names: names ? new Set(names) : null });
  }
  return map;
}

describe('reconcile: store reachability', () => {
  it('reports unreachable stores as high severity', () => {
    const declared = buildDeclared();
    const live = makeLive([['vercel-var', 'unreachable', null]]);
    const findings = reconcile(declared, live);
    const unreachable = mustFind(findings, 'store-unreachable');
    expect(unreachable.severity).toBe('high');
  });

  it('escalates unreachable stores to critical in strict mode', () => {
    const declared = buildDeclared();
    const live = makeLive([['github-secret', 'unreachable', null]]);
    const findings = reconcile(declared, live, { strict: true });
    const unreachable = mustFind(findings, 'store-unreachable');
    expect(unreachable.severity).toBe('critical');
  });

  it('does not report reachable stores', () => {
    const declared = buildDeclared();
    const live = makeLive([['vercel-var', 'ok', ['NEXT_PUBLIC_SITE_URL']]]);
    const findings = reconcile(declared, live);
    expect(findings.find((f) => f.code === 'store-unreachable')).toBeUndefined();
  });

  it('filters findings by store prefix', () => {
    const declared = buildDeclared();
    const live = makeLive([
      ['vercel-var', 'ok', []],
      ['github-secret', 'ok', []],
    ]);
    const findings = reconcile(declared, live, { storeFilter: 'vercel' });
    const githubFindings = findings.filter((f) => f.store?.startsWith('github'));
    expect(githubFindings).toEqual([]);
  });
});

describe('reconcile: required-missing', () => {
  it('reports a required value absent from a reachable store', () => {
    const declared = new Map([
      [
        'STRIPE_SECRET_KEY',
        {
          sources: new Set(['vercel-env.mjs']),
          required: true,
          stores: new Set(['vercel-secret']),
        },
      ],
    ]);
    const live = makeLive([['vercel-secret', 'ok', []]]);
    const findings = reconcile(declared, live);
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe('required-missing');
    expect(findings[0].severity).toBe('critical');
    expect(findings[0].name).toBe('STRIPE_SECRET_KEY');
    expect(findings[0].store).toBe('vercel-secret');
  });

  it('reports high severity for non-privileged required values', () => {
    const declared = new Map([
      [
        'SUPABASE_PROJECT_REF',
        { sources: new Set(['ci-env.mjs']), required: true, stores: new Set(['github-var']) },
      ],
    ]);
    const live = makeLive([['github-var', 'ok', []]]);
    const findings = reconcile(declared, live);
    expect(findings[0].severity).toBe('high');
  });

  it('does not report required values that are present', () => {
    const declared = new Map([
      [
        'STRIPE_SECRET_KEY',
        {
          sources: new Set(['vercel-env.mjs']),
          required: true,
          stores: new Set(['vercel-secret']),
        },
      ],
    ]);
    const live = makeLive([['vercel-secret', 'ok', ['STRIPE_SECRET_KEY']]]);
    expect(reconcile(declared, live)).toEqual([]);
  });

  it('does not report required values in unreachable stores', () => {
    const declared = new Map([
      [
        'STRIPE_SECRET_KEY',
        {
          sources: new Set(['vercel-env.mjs']),
          required: true,
          stores: new Set(['vercel-secret']),
        },
      ],
    ]);
    const live = makeLive([['vercel-secret', 'unreachable', null]]);
    const findings = reconcile(declared, live);
    expect(findings.find((f) => f.code === 'required-missing')).toBeUndefined();
  });

  it('does not report optional values that are absent', () => {
    const declared = new Map([
      [
        'ADMIN_ORDER_EMAIL',
        { sources: new Set(['vercel-env.mjs']), required: false, stores: new Set(['vercel-var']) },
      ],
    ]);
    const live = makeLive([['vercel-var', 'ok', []]]);
    expect(reconcile(declared, live)).toEqual([]);
  });
});

describe('reconcile: must-be-unset', () => {
  it('reports a mustBeUnset value that is present', () => {
    const declared = buildDeclared();
    const live = makeLive([['edge-secret', 'ok', ['WALLE_REFRESH_TOKEN']]]);
    const findings = reconcile(declared, live);
    const finding = mustFind(findings, 'must-be-unset');
    expect(finding.severity).toBe('critical');
    expect(finding.name).toBe('WALLE_REFRESH_TOKEN');
  });

  it('does not report a mustBeUnset value that is absent', () => {
    const declared = buildDeclared();
    const live = makeLive([['edge-secret', 'ok', []]]);
    const findings = reconcile(declared, live);
    expect(findings.find((f) => f.code === 'must-be-unset')).toBeUndefined();
  });
});

describe('reconcile: misfiled', () => {
  it('reports a value in an unexpected store', () => {
    const declared = new Map([
      [
        'STRIPE_SECRET_KEY',
        {
          sources: new Set(['vercel-env.mjs']),
          required: true,
          stores: new Set(['vercel-secret', 'edge-secret']),
        },
      ],
    ]);
    const live = makeLive([['github-secret', 'ok', ['STRIPE_SECRET_KEY']]]);
    const findings = reconcile(declared, live);
    const finding = mustFind(findings, 'misfiled');
    expect(finding.store).toBe('github-secret');
  });

  it('does not report a value in an expected store', () => {
    const declared = new Map([
      [
        'STRIPE_SECRET_KEY',
        {
          sources: new Set(['vercel-env.mjs']),
          required: true,
          stores: new Set(['vercel-secret', 'edge-secret']),
        },
      ],
    ]);
    const live = makeLive([['vercel-secret', 'ok', ['STRIPE_SECRET_KEY']]]);
    expect(reconcile(declared, live)).toEqual([]);
  });

  it('does not report values in the local store', () => {
    const declared = new Map([
      [
        'STRIPE_SECRET_KEY',
        {
          sources: new Set(['vercel-env.mjs']),
          required: true,
          stores: new Set(['vercel-secret']),
        },
      ],
    ]);
    const live = makeLive([['local', 'ok', ['STRIPE_SECRET_KEY']]]);
    expect(reconcile(declared, live)).toEqual([]);
  });
});

describe('reconcile: public-in-secret-store', () => {
  it('reports a NEXT_PUBLIC_* value in github-secret', () => {
    const declared = buildDeclared();
    const live = makeLive([['github-secret', 'ok', ['NEXT_PUBLIC_SITE_URL']]]);
    const findings = reconcile(declared, live);
    const finding = mustFind(findings, 'public-in-secret-store');
    expect(finding.severity).toBe('critical');
    expect(finding.store).toBe('github-secret');
  });

  it('does not report a NEXT_PUBLIC_* value in github-var', () => {
    const declared = buildDeclared();
    const live = makeLive([['github-var', 'ok', ['NEXT_PUBLIC_SITE_URL']]]);
    const findings = reconcile(declared, live);
    expect(findings.find((f) => f.code === 'public-in-secret-store')).toBeUndefined();
  });

  it('does not report in the edge store (unsplit bucket)', () => {
    const declared = buildDeclared();
    const live = makeLive([['edge-secret', 'ok', ['SUPABASE_URL']]]);
    const findings = reconcile(declared, live);
    expect(findings.find((f) => f.code === 'public-in-secret-store')).toBeUndefined();
  });
});

describe('reconcile: undeclared-live', () => {
  it('reports a value with no registry entry', () => {
    const declared = buildDeclared();
    const live = makeLive([['edge-secret', 'ok', ['TOTALLY_UNKNOWN_SECRET']]]);
    const findings = reconcile(declared, live);
    const finding = mustFind(findings, 'undeclared-live');
    expect(finding.name).toBe('TOTALLY_UNKNOWN_SECRET');
  });

  it('reports quarantined values with their severity', () => {
    const declared = buildDeclared();
    const live = makeLive([['edge-secret', 'ok', ['GITHUB_TOKEN']]]);
    const findings = reconcile(declared, live);
    const finding = mustFind(findings, 'undeclared-live');
    expect(finding.severity).toBe('critical');
  });

  it('does not report registered values as undeclared', () => {
    const declared = buildDeclared();
    const live = makeLive([['edge-secret', 'ok', ['STRIPE_SECRET_KEY']]]);
    const findings = reconcile(declared, live);
    expect(findings.find((f) => f.code === 'undeclared-live')).toBeUndefined();
  });

  it('does not report declared values as undeclared', () => {
    const declared = buildDeclared();
    const live = makeLive([['github-var', 'ok', ['SUPABASE_PROJECT_REF']]]);
    const findings = reconcile(declared, live);
    expect(findings.find((f) => f.code === 'undeclared-live')).toBeUndefined();
  });

  it('does not report values in the local store', () => {
    const declared = buildDeclared();
    const live = makeLive([['local', 'ok', ['SOME_LOCAL_ONLY_VAR']]]);
    const findings = reconcile(declared, live);
    expect(findings.find((f) => f.code === 'undeclared-live')).toBeUndefined();
  });
});

describe('reconcile: rotation-blast-radius', () => {
  it('reports info when a privileged value is in multiple stores', () => {
    const declared = buildDeclared();
    const live = makeLive([
      ['vercel-secret', 'ok', ['STRIPE_SECRET_KEY']],
      ['edge-secret', 'ok', ['STRIPE_SECRET_KEY']],
    ]);
    const findings = reconcile(declared, live);
    const finding = mustFind(findings, 'rotation-blast-radius');
    expect(finding.severity).toBe('info');
  });

  it('does not report when a privileged value is in only one store', () => {
    const declared = buildDeclared();
    const live = makeLive([['vercel-secret', 'ok', ['STRIPE_SECRET_KEY']]]);
    const findings = reconcile(declared, live);
    expect(findings.find((f) => f.code === 'rotation-blast-radius')).toBeUndefined();
  });

  it('does not report for non-privileged values', () => {
    const declared = buildDeclared();
    const live = makeLive([
      ['vercel-var', 'ok', ['NEXT_PUBLIC_SITE_URL']],
      ['github-var', 'ok', ['NEXT_PUBLIC_SITE_URL']],
    ]);
    const findings = reconcile(declared, live);
    expect(findings.find((f) => f.code === 'rotation-blast-radius')).toBeUndefined();
  });
});

describe('reconcile: full declared contract', () => {
  it('produces zero findings when all required values are present', () => {
    const declared = buildDeclared();
    const live = makeLive([
      [
        'vercel-var',
        'ok',
        [
          'NEXT_PUBLIC_SITE_URL',
          'NEXT_PUBLIC_SUPABASE_URL',
          'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
          'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
          'RESEND_FROM_EMAIL',
        ],
      ],
      [
        'vercel-secret',
        'ok',
        ['SUPABASE_SECRET_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY'],
      ],
      [
        'github-var',
        'ok',
        [
          'NEXT_PUBLIC_SUPABASE_URL',
          'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
          'NEXT_PUBLIC_SITE_URL',
          'SUPABASE_PROJECT_REF',
          'VERCEL_PROJECT_ID',
          'VERCEL_ORG_ID',
        ],
      ],
      [
        'github-secret',
        'ok',
        [
          'SUPABASE_ACCESS_TOKEN',
          'SUPABASE_DB_PASSWORD',
          'SUPABASE_POOLER_URL',
          'SUPABASE_SECRET_KEY',
          'RUNNERS_TOKEN',
          'VERCEL_TOKEN',
          'GH_AUDIT_TOKEN',
        ],
      ],
      [
        'edge-secret',
        'ok',
        [
          'STRIPE_SECRET_KEY',
          'STRIPE_WEBHOOK_SECRET',
          'APP_URL',
          'RESEND_API_KEY',
          'RESEND_FROM_EMAIL',
          'ADMIN_ORDER_EMAIL',
        ],
      ],
      ['edge-platform', 'ok', ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']],
      ['local', 'ok', []],
    ]);
    const findings = reconcile(declared, live);
    const nonInfo = findings.filter((f) => f.severity !== 'info');
    expect(nonInfo).toEqual([]);
  });
});

describe('auditRegistryConsistency', () => {
  it('produces zero findings for a consistent registry', () => {
    const declared = buildDeclared();
    const findings = auditRegistryConsistency(declared);
    expect(findings).toEqual([]);
  });

  it('reports when a NEXT_PUBLIC_* value is not classified public', () => {
    const declared = new Map();
    const original = REGISTRY.NEXT_PUBLIC_SITE_URL.exposure;
    REGISTRY.NEXT_PUBLIC_SITE_URL.exposure = 'server';
    const findings = auditRegistryConsistency(declared);
    REGISTRY.NEXT_PUBLIC_SITE_URL.exposure = original;
    expect(findings.find((f) => f.code === 'exposure-mismatch')).toBeDefined();
  });
});

describe('parseVercelTable', () => {
  it('parses CLI 59 format with Sensitive/Non-sensitive column', () => {
    const stdout = [
      'Vercel CLI 59.5.0',
      '',
      'Sensitive',
      'STRIPE_SECRET_KEY               eyJ2IjoidjIiLCJjIj…            Sensitive',
      'RESEND_API_KEY                   eyJ2IjoidjIiLCJjIj…            Sensitive',
      '',
      'Non-sensitive',
      'NEXT_PUBLIC_SITE_URL             https://test.example.com       Non-sensitive',
      'NEXT_PUBLIC_SUPABASE_URL         https://xyz.supabase.co       Non-sensitive',
    ].join('\n');
    const result = parseVercelTable(stdout);
    expect(result.secret).toEqual(['STRIPE_SECRET_KEY', 'RESEND_API_KEY']);
    expect(result.plain).toEqual(['NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_SUPABASE_URL']);
    expect(result.unknown).toEqual([]);
  });

  it('parses older format with Encrypted/Plain column', () => {
    const stdout = [
      'Vercel CLI 40.0.0',
      '',
      'Encrypted',
      'STRIPE_SECRET_KEY               sk_live_xxx…                   Encrypted',
      '',
      'Plain',
      'NEXT_PUBLIC_SITE_URL             https://test.example.com       Plain',
    ].join('\n');
    const result = parseVercelTable(stdout);
    expect(result.secret).toEqual(['STRIPE_SECRET_KEY']);
    expect(result.plain).toEqual(['NEXT_PUBLIC_SITE_URL']);
  });

  it('routes unrecognized layouts to unknown', () => {
    const stdout = 'SOME_VAR   some_value   UnknownFormat';
    const result = parseVercelTable(stdout);
    expect(result.unknown).toEqual(['SOME_VAR']);
    expect(result.plain).toEqual([]);
    expect(result.secret).toEqual([]);
  });

  it('skips lines with fewer than 2 columns', () => {
    expect(parseVercelTable('JUST_A_NAME')).toEqual({ plain: [], secret: [], unknown: [] });
  });

  it('skips names that do not match the env var pattern', () => {
    const stdout = 'lowercase_var   some_value   Sensitive';
    expect(parseVercelTable(stdout).secret).toEqual([]);
  });
});

describe('remediationFor', () => {
  it('produces edge-secret remediation', () => {
    expect(remediationFor('edge-secret', 'STRIPE_SECRET_KEY')).toContain('supabase secrets set');
  });

  it('produces github-secret remediation', () => {
    expect(remediationFor('github-secret', 'SUPABASE_ACCESS_TOKEN')).toContain('gh secret set');
  });

  it('produces github-var remediation', () => {
    expect(remediationFor('github-var', 'SUPABASE_PROJECT_REF')).toContain('gh variable set');
  });

  it('produces vercel-secret remediation', () => {
    expect(remediationFor('vercel-secret', 'STRIPE_SECRET_KEY')).toContain('--sensitive');
  });

  it('produces vercel-var remediation', () => {
    expect(remediationFor('vercel-var', 'NEXT_PUBLIC_SITE_URL')).not.toContain('--sensitive');
  });
});

describe('fingerprint', () => {
  it('uses code:store:name format', () => {
    const f = { code: 'required-missing', store: 'vercel-secret', name: 'STRIPE_SECRET_KEY' };
    expect(fingerprint(f)).toBe('required-missing:vercel-secret:STRIPE_SECRET_KEY');
  });

  it('uses dash for missing store and name', () => {
    const f = { code: 'store-unreachable', store: 'github-secret' };
    expect(fingerprint(f)).toBe('store-unreachable:github-secret:-');
  });
});

describe('summarize', () => {
  it('returns the first clause before an em dash', () => {
    expect(summarize('STRIPE_SECRET_KEY is declared required — exposure: privileged')).toBe(
      'STRIPE_SECRET_KEY is declared required'
    );
  });

  it('truncates long summaries at a word boundary', () => {
    const long = 'A'.repeat(200);
    const result = summarize(long);
    expect(result.length).toBeLessThanOrEqual(120);
    expect(result.endsWith('…')).toBe(true);
  });
});
