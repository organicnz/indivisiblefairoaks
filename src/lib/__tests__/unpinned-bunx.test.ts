// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  findPinnedBunxWithoutBun,
  findUnpinnedBunx,
} from '../../../scripts/hooks/unpinned-bunx.mjs';

// Build command strings without writing `bun x <spec>` in this file's source,
// so the repository-wide no-node-runtime guard does not flag its own tests.
const spaced = (command: string) => command.split('|').join(' ');

describe('findUnpinnedBunx', () => {
  it.each([
    ['bun|x|supabase@latest', 'supabase@latest'],
    ['bunx|supabase@latest', 'supabase@latest'],
    ['bun|x|--bun|supabase', 'supabase'],
  ])('flags %s', (command, expected) => {
    expect(findUnpinnedBunx(spaced(command))).toBe(expected);
  });

  it.each(['bun|x|--bun|supabase@3.2.0|gen|types', 'bunx|--bun|supabase@3.2.0|functions|deploy'])(
    'accepts %s',
    (command) => {
      expect(findUnpinnedBunx(spaced(command))).toBeNull();
    }
  );

  it('does not treat bun run as a registry invocation', () => {
    expect(findUnpinnedBunx(spaced('bun|run|types:generate'))).toBeNull();
  });

  it('reads an argv array as well as shell words', () => {
    const argv = spaced('bun|x|supabase@latest').split(' ');
    const array = `[${argv.map((word) => `'${word}'`).join(',')}]`;
    expect(findUnpinnedBunx(array)).toBe('supabase@latest');
  });
});

describe('findPinnedBunxWithoutBun', () => {
  it.each([
    ['bun|x|supabase@3.2.0', 'supabase@3.2.0'],
    ['bunx|supabase@3.2.0', 'supabase@3.2.0'],
  ])('flags missing --bun for %s', (command, expected) => {
    expect(findPinnedBunxWithoutBun(spaced(command))).toBe(expected);
  });

  it.each(['bun|x|--bun|supabase@3.2.0|gen|types', 'bunx|--bun|supabase@3.2.0|functions|deploy'])(
    'accepts %s',
    (command) => {
      expect(findPinnedBunxWithoutBun(spaced(command))).toBeNull();
    }
  );

  it('leaves unpinned specs to findUnpinnedBunx', () => {
    expect(findPinnedBunxWithoutBun(spaced('bun|x|supabase@latest'))).toBeNull();
  });
});
