// @vitest-environment node
//
// The shared `.env.local` loader.
//
// The environment is load-bearing: Vitest's `jsdom` environment replaces the
// worker's global with the jsdom window's, and the `Bun` global does not
// survive that swap everywhere. This suite has no DOM to work with — it
// exercises `atob` and `btoa`, which are globals in every environment.
//
// `scripts/hooks/vitest-environment.mjs` enforces this for every test file
// that reaches for `Bun.*`, directly or through an imported script.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadEnvLocal } from '../../../scripts/load-env-local.mjs';

let dir: string;
let file: string;

/** A collector: the loader writes here instead of into the real environment. */
type Env = Record<string, string | undefined>;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'load-env-'));
  file = join(dir, '.env.local');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('loadEnvLocal', () => {
  it('loads a key', async () => {
    writeFileSync(file, 'LOADER_TEST_PLAIN=value\n');
    const target: Env = {};
    const loaded = await loadEnvLocal({ path: file, target });

    expect(loaded).toBe(1);
    expect(target.LOADER_TEST_PLAIN).toBe('value');
  });

  it("strips surrounding quotes, the way Bun's own .env parser does", async () => {
    // Two of this repository's real `.env.local` values are quoted, and both
    // are API credentials — so a loader that kept the quotes would hand the
    // next script a token with quote characters on the end, and the failure
    // would be an authentication error that says nothing about the cause.
    writeFileSync(file, 'LOADER_TEST_QUOTED="quoted"\n');
    const target: Env = {};
    await loadEnvLocal({ path: file, target });

    expect(target.LOADER_TEST_QUOTED).toBe('quoted');
  });

  it('strips single quotes too', async () => {
    writeFileSync(file, "LOADER_TEST_QUOTED='quoted'\n");
    const target: Env = {};
    await loadEnvLocal({ path: file, target });

    expect(target.LOADER_TEST_QUOTED).toBe('quoted');
  });

  it('trims surrounding whitespace', async () => {
    writeFileSync(file, 'LOADER_TEST_PLAIN=  spaced  \n');
    const target: Env = {};
    await loadEnvLocal({ path: file, target });

    expect(target.LOADER_TEST_PLAIN).toBe('spaced');
  });

  it('leaves a quote that is not on both ends alone', async () => {
    // Only a *surrounding* pair is a quote. A value that merely contains one
    // — a password, a shell fragment — must survive intact.
    writeFileSync(file, 'LOADER_TEST_PLAIN=a"b\n');
    const target: Env = {};
    await loadEnvLocal({ path: file, target });

    expect(target.LOADER_TEST_PLAIN).toBe('a"b');
  });

  it('does not overwrite a variable the environment already set', async () => {
    // The shell's environment wins, and so does CI's: a checked-out file must
    // never clobber an injected value.
    const target: Env = { LOADER_TEST_PLAIN: 'from-the-environment' };
    writeFileSync(file, 'LOADER_TEST_PLAIN=from-the-file\n');
    const loaded = await loadEnvLocal({ path: file, target });

    expect(loaded).toBe(0);
    expect(target.LOADER_TEST_PLAIN).toBe('from-the-environment');
  });

  it('ignores lines that are not assignments', async () => {
    writeFileSync(
      file,
      ['# a comment', '', 'not an assignment', 'lower_case=ignored', 'LOADER_TEST_PLAIN=ok'].join(
        '\n'
      )
    );
    const target: Env = {};
    const loaded = await loadEnvLocal({ path: file, target });

    expect(loaded).toBe(1);
    expect(target.LOADER_TEST_PLAIN).toBe('ok');
  });

  it('is a no-op when the file is absent', async () => {
    // CI injects the environment instead, so a missing file is the normal
    // case there and must not be an error.
    const target: Env = {};
    const loaded = await loadEnvLocal({ path: join(dir, 'does-not-exist'), target });

    expect(loaded).toBe(0);
  });

  it('writes to the process environment by default, and Bun.env sees it', async () => {
    // The default target is the process environment, and every *read* in
    // `scripts/` and `e2e/` goes through `Bun.env`. Bun documents it as an
    // alias, so a value written here is visible there — which is what makes
    // the split between "writes use process.env" and "reads use Bun.env"
    // safe.
    //
    // This is the one assertion that has to touch the real environment, so
    // the key is removed again afterwards: a variable left behind would
    // change what a later file in the same worker sees.
    writeFileSync(file, 'LOADER_TEST_ALIAS=visible\n');
    try {
      await loadEnvLocal({ path: file });

      expect(Bun.env.LOADER_TEST_ALIAS).toBe('visible');
    } finally {
      delete process.env.LOADER_TEST_ALIAS;
    }
  });
});
