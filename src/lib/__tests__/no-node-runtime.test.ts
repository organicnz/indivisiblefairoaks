// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from '../../../scripts/bun-exec.mjs';

/**
 * Integration coverage for the guard's CLI boundary.
 *
 * The detector-helper tests prove the tokenizer's decisions. They do not prove
 * that the guard invokes it, reports the file and line, or applies the
 * `bin/npx` exemption. This suite runs the actual guard in a temporary
 * repository so a regression in any of those layers fails here.
 */

const GUARD = join(process.cwd(), 'scripts/hooks/no-node-runtime.mjs');

// Build command strings without writing the literal forms in this test's
// source, so the repository-wide guard does not flag its own tests.
const spaced = (command: string) => command.split('|').join(' ');

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'no-node-runtime-'));
  mkdirSync(join(dir, '.git'), { recursive: true });
  writeFileSync(join(dir, '.git/HEAD'), 'ref: refs/heads/main\n');
  mkdirSync(join(dir, 'node_modules/.bin'), { recursive: true });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function write(relativePath: string, contents: string) {
  const path = join(dir, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function guard(args: string[]) {
  return run([process.execPath, GUARD, ...args], { cwd: dir });
}

describe('no-node-runtime guard integration', () => {
  it('rejects both unpinned package-runner forms at the file and line', () => {
    write(
      'fixture.ts',
      [
        `const shellForm = ${JSON.stringify(spaced('bun|x|supabase@latest'))};`,
        `const shorthandForm = ${JSON.stringify(spaced('bunx|supabase@latest'))};`,
      ].join('\n')
    );

    const result = guard(['fixture.ts']);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/fixture\.ts:1\s+\[unpinned package runner\]/);
    expect(result.stdout).toMatch(/fixture\.ts:2\s+\[unpinned package runner\]/);
    expect(result.stdout.match(/\[unpinned package runner\]/g)).toHaveLength(2);
  });

  it('accepts a pinned package runner with --bun', () => {
    write('fixture.ts', `const forced = ${JSON.stringify(spaced('bun|x|--bun|supabase@3.2.0'))};`);

    const result = guard(['fixture.ts']);

    expect(result.exitCode).toBe(0);
  });

  it('rejects a local binary without --bun', () => {
    write('node_modules/.bin/biome', '#!/usr/bin/env node\n');
    write('fixture.ts', `const cmd = ${JSON.stringify(spaced('bun|biome|ci|./src'))};`);

    const result = guard(['fixture.ts']);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/fixture\.ts:1\s+\[local binary not pinned to Bun\]/);
  });

  it('accepts a local binary with --bun', () => {
    write('node_modules/.bin/biome', '#!/usr/bin/env node\n');
    write('fixture.ts', `const cmd = ${JSON.stringify(spaced('bun|--bun|biome|ci|./src'))};`);

    const result = guard(['fixture.ts']);

    expect(result.exitCode).toBe(0);
  });

  it('scans bin/npx and exempts its forwarding invocation', () => {
    write(
      'bin/npx',
      [
        '#!/usr/bin/env bash',
        'set -euo pipefail',
        `exec ${spaced('bun|x|--bun')} "$@"`,
        `exec ${spaced('bunx|--bun')} "$@"`,
      ].join('\n')
    );

    // `--all` rather than an explicit path: when `bin/npx` is the only file in
    // the temporary repository, a clean exit proves the tree walk included and
    // read it. If it were excluded, the guard's "scanned 0 files" check would
    // fail; without the exemption, the unpinned rule would fail instead.
    const result = guard(['--all']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(/scanned 0 files/);
    expect(result.stdout).not.toMatch(/unpinned package runner/);
  });
});
