// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseBunInvocations } from '../../../scripts/hooks/bun-invocations.mjs';

// Build command strings without writing the literal forms in this test's
// source, so the repository-wide guard does not flag its own tests.
const spaced = (command: string) => command.split('|').join(' ');

describe('parseBunInvocations', () => {
  it.each([
    ['bun|x|--bun|supabase@3.2.0|gen|types', 'supabase@3.2.0'],
    ['bunx|--bun|supabase@3.2.0|functions|deploy', 'supabase@3.2.0'],
  ])('models the package-runner form %s', (command, target) => {
    expect(parseBunInvocations(spaced(command))).toEqual([
      { kind: 'package', target, flags: ['--bun'], forcedBun: true },
    ]);
  });

  it.each([
    ['bun|--bun|biome|ci|./src', ['--bun']],
    ['bun|run|--bun|biome|ci', ['--bun']],
    ['bun|biome|ci|./src', []],
  ])('models the local-binary form %s', (command, flags) => {
    expect(parseBunInvocations(spaced(command))).toEqual([
      { kind: 'local', target: 'biome', flags, forcedBun: flags.includes('--bun') },
    ]);
  });

  it('keeps a missing --bun visible on both invocation kinds', () => {
    expect(parseBunInvocations(spaced('bun|x|supabase@3.2.0'))).toEqual([
      { kind: 'package', target: 'supabase@3.2.0', flags: [], forcedBun: false },
    ]);
    expect(parseBunInvocations(spaced('bun|biome'))).toEqual([
      { kind: 'local', target: 'biome', flags: [], forcedBun: false },
    ]);
  });

  it('does not confuse a run script with a package runner', () => {
    expect(parseBunInvocations(spaced('bun|run|types:generate'))).toEqual([
      { kind: 'local', target: 'types:generate', flags: [], forcedBun: false },
    ]);
  });

  it('reads argv arrays and finds every invocation on a compound line', () => {
    const argv = spaced('bun|x|--bun|supabase@3.2.0').split(' ');
    const array = `[${argv.map((word) => `'${word}'`).join(',')}]`;
    expect(parseBunInvocations(array)).toEqual([
      { kind: 'package', target: 'supabase@3.2.0', flags: ['--bun'], forcedBun: true },
    ]);

    const compound = `${spaced('bun|biome')} && ${spaced('bunx|--bun|supabase@3.2.0')}`;
    expect(parseBunInvocations(compound)).toEqual([
      { kind: 'local', target: 'biome', flags: [], forcedBun: false },
      { kind: 'package', target: 'supabase@3.2.0', flags: ['--bun'], forcedBun: true },
    ]);
  });
});
