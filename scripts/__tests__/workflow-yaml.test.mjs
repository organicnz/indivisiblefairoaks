// @vitest-environment node

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SHA = 'a'.repeat(40);
const HOOK = 'scripts/hooks/workflow-yaml.mjs';

let directory;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'workflow-yaml-'));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

function runHook(file) {
  const result = Bun.spawnSync({
    cmd: [process.execPath, HOOK, file],
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
  });

  return {
    exitCode: result.exitCode,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

describe('workflow-yaml CLI', () => {
  it('rejects a folded floating ref and reports its workflow path', () => {
    const file = join(directory, 'folded.yml');
    writeFileSync(
      file,
      ['jobs:', '  check:', '    steps:', '      - uses: >-', '          actions/checkout@v7'].join(
        '\n'
      )
    );

    const result = runHook(file);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('jobs.check.steps[0].uses');
    expect(result.output).toContain('actions/checkout@v7');
    expect(result.output).toContain('must be pinned to a full commit SHA');
  });

  it('accepts a pinned workflow', () => {
    const file = join(directory, 'pinned.yml');
    writeFileSync(
      file,
      ['jobs:', '  check:', '    steps:', `      - uses: actions/checkout@${SHA}`].join('\n')
    );

    const result = runHook(file);

    expect(result.exitCode).toBe(0);
    expect(result.output).toBe('');
  });
});
