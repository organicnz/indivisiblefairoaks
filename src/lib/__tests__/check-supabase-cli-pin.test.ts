// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CANONICAL_FILE,
  classifySupabaseCliPins,
  findSupabaseCliPins,
  main,
} from '../../../scripts/check-supabase-cli-pin.mjs';

// Build the package spec without writing the literal in this test's source.
const PACKAGE = ['supabase', '@'].join('');
const pin = (version: string) => `${PACKAGE}${version}`;

describe('findSupabaseCliPins', () => {
  it('finds concrete pins and ignores the workflow extraction pattern', () => {
    const source = [
      `const pinned = '${pin('3.2.0')}';`,
      `const tagged = '${pin('latest')}';`,
      `grep -oE "${PACKAGE}[0-9]+\\.[0-9]+\\.[0-9]+"`,
    ].join('\n');

    expect(findSupabaseCliPins(source)).toEqual([
      { line: 1, spec: pin('3.2.0') },
      { line: 2, spec: pin('latest') },
    ]);
  });
});

describe('classifySupabaseCliPins', () => {
  it('allows only the canonical file and reports every other pin', () => {
    const result = classifySupabaseCliPins([
      {
        path: CANONICAL_FILE,
        source: `export const SUPABASE_CLI = ['${pin('3.2.0')}'];`,
      },
      { path: 'scripts/other.mjs', source: `const cmd = '${pin('3.1.0')}';` },
      { path: 'scripts/third.mjs', source: `// ${pin('latest')}` },
    ]);

    expect(result.canonicalPins).toBe(1);
    expect(result.outside).toEqual([
      { path: 'scripts/other.mjs', line: 1, spec: pin('3.1.0') },
      { path: 'scripts/third.mjs', line: 1, spec: pin('latest') },
    ]);
  });

  it('reports a missing canonical pin instead of passing vacuously', () => {
    expect(
      classifySupabaseCliPins([{ path: CANONICAL_FILE, source: 'export const SUPABASE_CLI = [];' }])
    ).toEqual({ outside: [], canonicalPins: 0 });
  });
});

describe('Supabase CLI pin on this repository', () => {
  it('finds the literal only in the canonical module', async () => {
    const logs: string[] = [];
    const errors: string[] = [];

    expect(
      await main({
        root: process.cwd(),
        log: (message) => logs.push(message),
        error: (message) => errors.push(message),
      })
    ).toBe(0);

    expect(logs.join('\n')).toMatch(/appears only in scripts\/supabase-cli\.mjs/);
    expect(errors).toEqual([]);
  });

  describe('in a temporary repository', () => {
    let root: string;

    beforeEach(() => {
      root = mkdtempSync(join(tmpdir(), 'supabase-cli-pin-'));
      mkdirSync(join(root, 'scripts'), { recursive: true });
    });

    afterEach(() => {
      rmSync(root, { recursive: true, force: true });
    });

    it('fails when another script writes the pin', async () => {
      writeFileSync(
        join(root, CANONICAL_FILE),
        `export const SUPABASE_CLI = ['${pin('3.2.0')}'];\n`
      );
      writeFileSync(join(root, 'scripts/other.mjs'), `const cmd = '${pin('3.1.0')}';\n`);

      const logs: string[] = [];
      const errors: string[] = [];

      expect(
        await main({
          root,
          log: (message) => logs.push(message),
          error: (message) => errors.push(message),
        })
      ).toBe(1);

      expect(errors.join('\n')).toMatch(/scripts\/other\.mjs:1/);
      expect(errors.join('\n')).toContain(pin('3.1.0'));
      expect(logs).toEqual([]);
    });
  });
});
