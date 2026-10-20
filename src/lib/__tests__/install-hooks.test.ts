// @vitest-environment node
//
// The `prepare` script's four branches.
//
// This suite reads files off disk and calls scripts that use Bun's file APIs.
// It has no DOM to work with.
//
// The environment is load-bearing, and not for the reason it looks. Vitest's
// `jsdom` environment replaces the worker's global with the jsdom window's,
// and the `Bun` global does not survive that swap everywhere. This suite
// passed on macOS and failed on the Linux runner with
// `ReferenceError: Bun is not defined` — every test in it, at the first
// `Bun.file`.
//
// In a `node` environment the global is the worker's own, so `Bun` is there
// because the worker *is* a Bun process: Vitest spawns its workers with
// `process.execPath`, and this suite runs under `bun vitest`.
//
// `scripts/hooks/vitest-environment.mjs` enforces this for every test file
// that reaches for `Bun.*`, directly or through an imported script.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isGitCheckout,
  main,
  OUTCOME,
  resolveLefthookBin,
} from '../../../scripts/install-hooks.mjs';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'install-hooks-'));
});

afterEach(() => {
  // `rmSync` rather than a shell command: the repository runs commands
  // through argv arrays so that an interpolated path is an argument and
  // never shell syntax.
  rmSync(dir, { recursive: true, force: true });
});

describe('install-hooks', () => {
  describe('isGitCheckout', () => {
    it('accepts a directory containing .git', () => {
      mkdirSync(join(dir, '.git'));
      expect(isGitCheckout(dir)).toBe(true);
    });

    it('accepts a .git *file*, which is a worktree or submodule pointer', () => {
      writeFileSync(join(dir, '.git'), 'gitdir: /elsewhere\n');
      expect(isGitCheckout(dir)).toBe(true);
    });

    it('rejects a directory with no .git', () => {
      expect(isGitCheckout(dir)).toBe(false);
    });
  });

  describe('resolveLefthookBin', () => {
    it('resolves lefthook through its own bin metadata', async () => {
      const bin = await resolveLefthookBin(process.cwd());
      expect(bin).not.toBeNull();
      // The path is derived from the package's `bin` field, so it points at
      // the real entry point rather than a hard-coded internal path.
      expect(bin?.endsWith('lefthook/bin/index.js')).toBe(true);
    });

    it('resolves the copy the lockfile pins, not one from the global cache', async () => {
      // `Bun.resolveSync` would fall back to Bun's *global install cache*
      // here, and it holds a different version of lefthook than the project
      // depends on — measured: the project pins 2.1.12 and the cache copy is
      // 2.2.2. Resolving from the project's own `node_modules` is what stops
      // the hooks being installed by a different version of lefthook than the
      // repository depends on.
      const bin = await resolveLefthookBin(process.cwd());
      expect(bin).not.toBeNull();
      expect(bin?.startsWith(join(process.cwd(), 'node_modules'))).toBe(true);
      expect(bin).not.toContain('/.bun/install/cache/');

      // The version of the package the resolved entry point actually belongs
      // to, read from that package — not from a path the test assumed.
      const packageRoot = join(bin as string, '..', '..');
      const resolvedVersion = JSON.parse(
        readFileSync(join(packageRoot, 'package.json'), 'utf8')
      ).version;
      const projectVersion = JSON.parse(
        readFileSync(join(process.cwd(), 'node_modules/lefthook/package.json'), 'utf8')
      ).version;
      expect(resolvedVersion).toBe(projectVersion);
    });

    it('returns null where lefthook is not installed', async () => {
      // A directory with no node_modules: nothing to resolve.
      expect(await resolveLefthookBin(dir)).toBeNull();
    });
  });

  describe('main', () => {
    it('does nothing outside a git checkout', async () => {
      const spawn = vi.fn();
      const outcome = await main({ root: dir, spawn });

      expect(outcome).toBe(OUTCOME.NOT_A_CHECKOUT);
      // The point of the branch: nothing was run.
      expect(spawn).not.toHaveBeenCalled();
    });

    it('does nothing when lefthook is not installed', async () => {
      mkdirSync(join(dir, '.git'));
      const spawn = vi.fn();
      const outcome = await main({ root: dir, spawn });

      expect(outcome).toBe(OUTCOME.LEFTHOOK_ABSENT);
      expect(spawn).not.toHaveBeenCalled();
    });

    it('installs the hooks on Bun, and says so', async () => {
      const spawn = vi.fn().mockReturnValue({ exitCode: 0 });
      const outcome = await main({ root: process.cwd(), spawn });

      expect(outcome).toBe(OUTCOME.INSTALLED);
      expect(spawn).toHaveBeenCalledTimes(1);

      const [argv] = spawn.mock.calls[0];
      // `process.execPath` is the bun binary, and `--bun` forces Bun's
      // runtime for the child whatever lefthook's own shebang says. This is
      // the whole point: lefthook's bin is a `#!/usr/bin/env node` script.
      expect(argv[0]).toBe(process.execPath);
      expect(argv[1]).toBe('--bun');
      expect(argv[2]).toMatch(/lefthook[\\/]bin[\\/]index\.js$/);
      expect(argv[3]).toBe('install');
    });

    it('reports a failed install without failing the install', async () => {
      const spawn = vi.fn().mockReturnValue({ exitCode: 3 });
      const outcome = await main({ root: process.cwd(), spawn });

      // The outcome is reported, but `main` resolves rather than throwing:
      // a broken hook install must not break `bun install`, or a developer
      // cannot get their dependencies installed at all.
      expect(outcome).toBe(OUTCOME.INSTALL_FAILED);
    });
  });
});
