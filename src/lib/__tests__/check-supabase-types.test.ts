// @vitest-environment node
//
// The freshness check's local/CI split, and the token resolver the post-commit
// hook uses before it attempts generation. These are the two branches that
// decide whether a missing Management API credential is a quiet skip or a
// failure, so they are tested without a live Supabase project or network.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../../../scripts/check-supabase-types.mjs';
import { resolveSupabaseAccessToken } from '../../../scripts/supabase-access-token.mjs';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'supabase-type-check-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function capture() {
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    logs,
    errors,
    log: (message: string) => logs.push(message),
    error: (message: string) => errors.push(message),
  };
}

describe('check-supabase-types', () => {
  it('skips without running the generator when no token is available locally', async () => {
    const output = capture();
    const generate = vi.fn();

    const code = await main({ token: '', generate, ...output });

    expect(code).toBe(0);
    expect(generate).not.toHaveBeenCalled();
    expect(output.logs.join('\n')).toMatch(/skipping generated-type freshness check/);
    expect(output.errors).toEqual([]);
  });

  it('fails without running the generator when CI requires a token', async () => {
    const output = capture();
    const generate = vi.fn();

    const code = await main({ token: '', requireToken: true, generate, ...output });

    expect(code).toBe(1);
    expect(generate).not.toHaveBeenCalled();
    expect(output.errors.join('\n')).toMatch(/SUPABASE_ACCESS_TOKEN is required/);
  });

  it('runs the non-writing check when a token is present', async () => {
    const output = capture();
    const generate = vi.fn().mockResolvedValue(0);

    const code = await main({ token: 'tok_test', generate, ...output });

    expect(code).toBe(0);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(output.logs.join('\n')).toMatch(/is current/);
  });

  it('reports the remediation when the generated file is stale', async () => {
    const output = capture();
    const generate = vi.fn().mockResolvedValue(1);

    const code = await main({ token: 'tok_test', generate, ...output });

    expect(code).toBe(1);
    expect(output.errors.join('\n')).toMatch(/bun run types:generate/);
    expect(output.errors.join('\n')).toMatch(/must not be edited by hand/);
  });
});

describe('resolveSupabaseAccessToken', () => {
  it('prefers a shell-injected token over .env.local', async () => {
    const file = join(dir, '.env.local');
    writeFileSync(file, 'SUPABASE_ACCESS_TOKEN="file-token"\n');

    expect(
      await resolveSupabaseAccessToken({
        env: { SUPABASE_ACCESS_TOKEN: 'shell-token' },
        file,
      })
    ).toBe('shell-token');
  });

  it('reads a quoted token from .env.local when the environment has none', async () => {
    const file = join(dir, '.env.local');
    writeFileSync(file, 'SUPABASE_ACCESS_TOKEN="file-token"\n');

    expect(await resolveSupabaseAccessToken({ env: {}, file })).toBe('file-token');
  });

  it('returns an empty string when neither source has a token', async () => {
    expect(await resolveSupabaseAccessToken({ env: {}, file: join(dir, '.env.local') })).toBe('');
  });
});
