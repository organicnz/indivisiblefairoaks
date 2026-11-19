// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { findUnpinnedBunx, isExactPackageSpec } from '../../../scripts/hooks/unpinned-bunx.mjs';

// Build command strings without writing `bun x <spec>` in this file's source,
// so the repository-wide no-node-runtime guard does not flag its own tests.
const spaced = (command: string) => command.split('|').join(' ');

describe('findUnpinnedBunx', () => {
  it('flags a tag in the shell form', () => {
    expect(findUnpinnedBunx(spaced('bun|x|supabase@latest'))).toBe('supabase@latest');
  });

  it('flags a tag in the shorthand form', () => {
    expect(findUnpinnedBunx(spaced('bunx|supabase@latest'))).toBe('supabase@latest');
  });

  it('flags a missing version after --bun', () => {
    expect(findUnpinnedBunx(spaced('bun|x|--bun|supabase'))).toBe('supabase');
  });

  it('accepts an exact version in the shell form', () => {
    expect(findUnpinnedBunx(spaced('bun|x|--bun|supabase@3.2.0|gen|types'))).toBeNull();
  });

  it('accepts an exact version in the shorthand form', () => {
    expect(findUnpinnedBunx(spaced('bunx|--bun|supabase@3.2.0|functions|deploy'))).toBeNull();
  });

  it('accepts a scoped package at an exact version', () => {
    expect(findUnpinnedBunx(spaced('bun|x|@scope/pkg@1.2.3|run'))).toBeNull();
  });

  it('flags a scoped package tag', () => {
    expect(findUnpinnedBunx(spaced('bun|x|@scope/pkg@latest'))).toBe('@scope/pkg@latest');
  });

  it('accepts --package with an exact version and a bare bin name', () => {
    expect(findUnpinnedBunx(spaced('bunx|--package|@scope/pkg@1.2.3|tool'))).toBeNull();
  });

  it('flags --package with a tag', () => {
    expect(findUnpinnedBunx(spaced('bunx|--package|@scope/pkg@latest|tool'))).toBe(
      '@scope/pkg@latest'
    );
  });

  it('does not treat bun run as a registry invocation', () => {
    expect(findUnpinnedBunx(spaced('bun|run|types:generate'))).toBeNull();
  });

  it('reads an argv array as well as shell words', () => {
    const argv = spaced('bun|x|supabase@latest').split(' ');
    const array = `[${argv.map((word) => `'${word}'`).join(',')}]`;
    expect(findUnpinnedBunx(array)).toBe('supabase@latest');
  });
});

describe('isExactPackageSpec', () => {
  it('accepts full semver, prerelease and build metadata', () => {
    expect(isExactPackageSpec('supabase@3.2.0')).toBe(true);
    expect(isExactPackageSpec('@scope/pkg@1.2.3-beta.1')).toBe(true);
    expect(isExactPackageSpec('pkg@1.2.3+build.5')).toBe(true);
  });

  it('rejects tags, ranges and partial versions', () => {
    expect(isExactPackageSpec('supabase@latest')).toBe(false);
    expect(isExactPackageSpec('supabase@^3.2.0')).toBe(false);
    expect(isExactPackageSpec('supabase@~3.2.0')).toBe(false);
    expect(isExactPackageSpec('supabase@3.2')).toBe(false);
    expect(isExactPackageSpec('supabase')).toBe(false);
  });
});
