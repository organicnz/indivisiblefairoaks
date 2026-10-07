import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main as checkDeploy } from '../../../scripts/check-vercel-deploy.mjs';
import { scrubSecrets } from '../../../scripts/scrub-secrets.mjs';
import { getFullBuildLog, VercelApiError } from '../../../scripts/vercel-api.mjs';

/**
 * Log capture for the post-merge deploy check: full-log pagination, secret
 * scrubbing, and the verdict-neutral capture contract.
 *
 * Two invariants pin this suite. First, capture is evidence, not verdict: a
 * capture failure degrades to a warning and the exit code still comes from
 * deployment state plus the health probe. Second, the mock boundary is the
 * same as the sibling suite's — `fetch` for the API shape, injectable `deps`
 * for decisions — so a wrong endpoint or parameter fails here at runtime,
 * not in review.
 */

const SHA = 'a'.repeat(40);
const OTHER_SHA = 'b'.repeat(40);

function env(over: Record<string, string | undefined> = {}) {
  return {
    VERCEL_PROJECT_ID: 'prj_test',
    VERCEL_ORG_ID: 'team_test',
    VERCEL_TOKEN: 'tok_test_12345678',
    ...over,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function deployment(over: Record<string, unknown> = {}) {
  return {
    uid: 'dpl_1',
    state: 'READY',
    url: 'indivisible-fairoaks-abc123',
    gitSource: { sha: SHA, ref: 'main' },
    errorCode: null,
    errorMessage: null,
    inspectorUrl: 'https://vercel.com/acme/nextjs/abc123',
    ...over,
  };
}

/** `listDeployments` mock that answers SHA-filtered and unfiltered calls differently. */
function shaAwareList(shaHits: unknown[], unfiltered: unknown[]) {
  return async (...callArgs: unknown[]) => {
    const opts = callArgs[3] as { sha?: string } | undefined;
    return opts?.sha ? shaHits : unfiltered;
  };
}

function eventsPage(events: unknown[]) {
  return jsonResponse(events);
}

function buildEvent(id: string, created: number, text: string) {
  return { id, created, text, type: 'stdout' };
}

async function freshTmpDir() {
  return await mkdtemp(path.join(tmpdir(), 'vercel-log-test-'));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getFullBuildLog pagination', () => {
  it('pages forward from the start until an empty page, oldest first', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        eventsPage([buildEvent('e1', 100, 'one'), buildEvent('e2', 200, 'two')])
      )
      .mockResolvedValueOnce(eventsPage([buildEvent('e3', 300, 'three')]))
      .mockResolvedValueOnce(eventsPage([]));
    vi.stubGlobal('fetch', fetchMock);

    const out = await getFullBuildLog('dpl_1', 'team_test', 'tok_test_12345678');

    expect(out).toMatchObject({ text: 'one\ntwo\nthree', truncated: false, eventCount: 3 });
    const urls = fetchMock.mock.calls.map(([u]) => new URL(u as string));
    expect(urls[0].searchParams.get('direction')).toBe('forward');
    expect(urls[0].searchParams.get('since')).toBeNull();
    expect(urls[1].searchParams.get('since')).toBe('200');
    expect(urls[2].searchParams.get('since')).toBe('300');
  });

  it('dedupes retransmitted events instead of looping on them', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(eventsPage([buildEvent('e1', 100, 'one')]))
      .mockResolvedValueOnce(
        eventsPage([buildEvent('e1', 100, 'one'), buildEvent('e2', 200, 'two')])
      )
      .mockResolvedValueOnce(eventsPage([buildEvent('e2', 200, 'two')]));
    vi.stubGlobal('fetch', fetchMock);

    const out = await getFullBuildLog('dpl_1', 'team_test', 'tok_test_12345678');

    expect(out.text).toBe('one\ntwo');
    expect(out.truncated).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('truncates at the byte cap and says so', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(eventsPage([buildEvent('e1', 100, '0123456789abcdef')]))
    );

    const out = await getFullBuildLog('dpl_1', 'team_test', 'tok_test_12345678', {
      maxBytes: 10,
    });

    expect(out.truncated).toBe(true);
    expect(out.text).toBe('');
  });

  it('truncates at the event cap and says so', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          eventsPage([buildEvent('e1', 100, 'one'), buildEvent('e2', 200, 'two')])
        )
        .mockResolvedValue(eventsPage([buildEvent('e3', 300, 'three')]))
    );

    const out = await getFullBuildLog('dpl_1', 'team_test', 'tok_test_12345678', {
      maxEvents: 2,
    });

    expect(out.truncated).toBe(true);
    expect(out.text).toBe('one\ntwo');
  });

  it('degrades to partial on a mid-capture transport failure instead of throwing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(eventsPage([buildEvent('e1', 100, 'one')]))
      .mockResolvedValueOnce({ ok: false, status: 502, json: async () => null });
    vi.stubGlobal('fetch', fetchMock);

    const out = await getFullBuildLog('dpl_1', 'team_test', 'tok_test_12345678');

    expect(out).toMatchObject({ text: 'one', truncated: true });
  });

  it('treats a non-array body as a drained page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ events: [] })));

    const out = await getFullBuildLog('dpl_1', 'team_test', 'tok_test_12345678');

    expect(out).toMatchObject({ text: '', truncated: false, eventCount: 0 });
  });
});

describe('scrubSecrets', () => {
  it('redacts exact secret values, even ones containing regex syntax', async () => {
    const value = 'tok_(test)+.*$pecial';
    expect(scrubSecrets(`key=${value} end`, [value])).toBe('key=[REDACTED] end');
  });

  it('skips values too short to be secrets rather than nuking ordinary words', async () => {
    expect(scrubSecrets('the token is abc', ['abc'])).toBe('the token is abc');
  });

  it('redacts token shapes without knowing the value', async () => {
    const dirty = [
      'stripe sk_live_abcDEF123',
      'github ghp_0123456789abcdefghij',
      'auth Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig',
      '-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----',
    ].join('\n');
    const clean = scrubSecrets(dirty, []);
    expect(clean).not.toMatch(/sk_live_/);
    expect(clean).not.toMatch(/ghp_/);
    expect(clean).not.toMatch(/eyJhbGciOi/);
    expect(clean).not.toMatch(/MIIB/);
    expect(clean.match(/\[REDACTED\]/g)).toHaveLength(4);
  });

  it('is total: non-strings yield empty, never a throw', async () => {
    expect(scrubSecrets(null)).toBe('');
    expect(scrubSecrets(undefined)).toBe('');
    expect(scrubSecrets(42)).toBe('');
    expect(scrubSecrets({ text: 'x' })).toBe('');
  });
});

describe('capture contract: verdict-neutral evidence', () => {
  const healthyFetch = () =>
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' })));

  it('exits 0 with a notice when the SHA was superseded by a newer push', async () => {
    const dir = await freshTmpDir();
    healthyFetch();
    const said: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
      said.push(a.join(' '));
    });

    const exit = await checkDeploy({
      env: env(),
      shaArg: SHA,
      budget: 1,
      interval: 0,
      healthBudget: 1,
      outDir: dir,
      listDeployments: shaAwareList([], [deployment({ gitSource: { sha: OTHER_SHA } })]),
      getBuildLog: async () => '',
      getFullBuildLog: async () => ({ text: '', truncated: false, eventCount: 0 }),
    });

    expect(exit).toBe(0);
    expect(said.join(' ')).toMatch(/superseded/i);
    const summary = await readFile(path.join(dir, 'vercel-build-aaaaaaaa.summary.md'), 'utf8');
    expect(summary).toMatch(/superseded/i);
    logSpy.mockRestore();
  });

  it('still exits 1 when nothing deployed and nothing newer exists', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exit = await checkDeploy({
      env: env(),
      shaArg: SHA,
      budget: 1,
      interval: 0,
      healthBudget: 1,
      listDeployments: shaAwareList([], []),
      getBuildLog: async () => '',
      getFullBuildLog: async () => ({ text: '', truncated: false, eventCount: 0 }),
    });
    expect(exit).toBe(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/No deployment for/);
    err.mockRestore();
  });

  it('exits 0 for a CANCELED build behind a newer deployment, 1 otherwise', async () => {
    healthyFetch();
    const quiet = {
      getBuildLog: async () => '',
      getFullBuildLog: async () => ({ text: '', truncated: false, eventCount: 0 }),
    };
    const canceled = [deployment({ state: 'CANCELED' })];

    const superseded = await checkDeploy({
      env: env(),
      shaArg: SHA,
      budget: 1,
      interval: 0,
      healthBudget: 1,
      listDeployments: shaAwareList(canceled, [deployment({ gitSource: { sha: OTHER_SHA } })]),
      ...quiet,
    });
    expect(superseded).toBe(0);

    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const genuine = await checkDeploy({
      env: env(),
      shaArg: SHA,
      budget: 1,
      interval: 0,
      healthBudget: 1,
      listDeployments: shaAwareList(canceled, canceled),
      ...quiet,
    });
    expect(genuine).toBe(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/Deployment CANCELED/);
    err.mockRestore();
  });

  it('tolerates transient API blips after a successful poll', async () => {
    healthyFetch();
    let calls = 0;
    const exit = await checkDeploy({
      env: env(),
      shaArg: SHA,
      budget: 10_000,
      interval: 0,
      healthBudget: 1,
      listDeployments: async () => {
        calls++;
        if (calls <= 2) throw new VercelApiError('blip', { status: 502 });
        return [deployment()];
      },
      getBuildLog: async () => '',
      getFullBuildLog: async () => ({ text: '', truncated: false, eventCount: 0 }),
    });
    expect(exit).toBe(0);
    expect(calls).toBeGreaterThan(2);
  });

  it('a capture failure warns but never flips a READY verdict', async () => {
    const dir = await freshTmpDir();
    healthyFetch();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const exit = await checkDeploy({
      env: env(),
      shaArg: SHA,
      budget: 1,
      interval: 0,
      healthBudget: 1,
      outDir: dir,
      listDeployments: async () => [deployment()],
      getBuildLog: async () => '',
      getFullBuildLog: async () => {
        throw new Error('events down');
      },
    });
    expect(exit).toBe(0);
    expect(warn.mock.calls.flat().join(' ')).toMatch(/capture failed/i);
    const summary = await readFile(path.join(dir, 'vercel-build-aaaaaaaa.summary.md'), 'utf8');
    expect(summary).toMatch(/capture failed/i);
    expect(summary).toMatch(/database reachable/i);
    warn.mockRestore();
  });

  it('scrubs secret values before writing the log file', async () => {
    const dir = await freshTmpDir();
    healthyFetch();
    const exit = await checkDeploy({
      env: env(),
      shaArg: SHA,
      budget: 1,
      interval: 0,
      healthBudget: 1,
      outDir: dir,
      listDeployments: async () => [deployment()],
      getBuildLog: async () => '',
      getFullBuildLog: async () => ({
        text: 'using token tok_test_12345678\nstripe sk_live_abcDEF123\nclean line',
        truncated: false,
        eventCount: 3,
      }),
    });
    expect(exit).toBe(0);
    const written = await readFile(path.join(dir, 'vercel-build-aaaaaaaa.log'), 'utf8');
    expect(written).not.toContain('tok_test_12345678');
    expect(written).not.toContain('sk_live_abcDEF123');
    expect(written).toContain('clean line');
    const summary = await readFile(path.join(dir, 'vercel-build-aaaaaaaa.summary.md'), 'utf8');
    expect(summary).not.toContain('tok_test_12345678');
  });

  it('caps the summary tail while the file keeps everything', async () => {
    const dir = await freshTmpDir();
    healthyFetch();
    const lines = Array.from({ length: 50 }, (_, i) => `line-${i}`);
    await checkDeploy({
      env: env(),
      shaArg: SHA,
      budget: 1,
      interval: 0,
      healthBudget: 1,
      outDir: dir,
      listDeployments: async () => [deployment()],
      getBuildLog: async () => '',
      getFullBuildLog: async () => ({ text: lines.join('\n'), truncated: false, eventCount: 50 }),
    });
    const written = await readFile(path.join(dir, 'vercel-build-aaaaaaaa.log'), 'utf8');
    expect(written).toContain('line-0');
    const summary = await readFile(path.join(dir, 'vercel-build-aaaaaaaa.summary.md'), 'utf8');
    expect(summary).toContain('line-49');
    expect(summary).not.toContain('line-0\n');
  });

  it('turns a check crash into exit 1, not a throw', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exit = await checkDeploy({
      env: env(),
      shaArg: SHA,
      budget: 1,
      interval: 0,
      healthBudget: 1,
      listDeployments: async () => {
        throw new Error('boom');
      },
    });
    expect(exit).toBe(1);
    err.mockRestore();
  });
});
