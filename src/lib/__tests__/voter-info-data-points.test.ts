// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VOTER_ARCHIVE_2026_DATA_POINT_KEYS,
  VOTER_INFO_ARCHIVED_2026_PREFIXES,
  VOTER_INFO_DATA_POINT_KEYS,
} from '@/components/voter-info/voter-info-data-points';

const createPublicClient = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase-server', () => ({ createPublicClient }));
vi.mock('@/lib/env', () => ({ env: { NEXT_E2E_BUILD: 'false' } }));
vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

const { getDataPointsForKeys } = await import('@/lib/queries/civic');

const isArchived2026 = (key: string) =>
  VOTER_INFO_ARCHIVED_2026_PREFIXES.some((prefix) => key.startsWith(prefix));

/** Every component the voter-info page renders, including its client widgets. */
const VOTER_INFO_SOURCES = [
  'src/app/voter-info/page.tsx',
  'src/components/voter-info/VoterActionCards.tsx',
  'src/components/voter-info/VoterGuidesSection.tsx',
  'src/components/voter-info/VoterHotlinesSection.tsx',
  'src/components/voter-info/VoterSectionNav.tsx',
  'src/components/ui/SacramentoRepresentativeFinder.tsx',
];

describe('voter-info data-point keys', () => {
  it('lists only evergreen keys, once each', () => {
    const keys = [...VOTER_INFO_DATA_POINT_KEYS];
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBe(56);
    expect(keys.filter(isArchived2026)).toEqual([]);
  });

  it('lists the 20 archived 2026 keys, once each', () => {
    const keys = [...VOTER_ARCHIVE_2026_DATA_POINT_KEYS];
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBe(20);
    expect(keys.filter((key) => !isArchived2026(key))).toEqual([]);
  });

  it('covers every voter key the page components read', async () => {
    const listed = new Set<string>(VOTER_INFO_DATA_POINT_KEYS);
    const missing: string[] = [];
    const archivedReferenced: string[] = [];

    for (const path of VOTER_INFO_SOURCES) {
      const source = await Bun.file(path).text();
      const names = [
        ...source.matchAll(/name="(voter\.[a-z0-9_.]+)"/g),
        ...source.matchAll(/dataPoints\[['"](voter\.[a-z0-9_.]+)['"]\]/g),
      ].map((match) => match[1]);

      for (const name of names) {
        if (isArchived2026(name)) {
          archivedReferenced.push(name);
        } else if (!listed.has(name)) {
          missing.push(`${name} (${path})`);
        }
      }
    }

    // Sanity: the 2026 block is still in VoterGuidesSection, so the archive
    // keys must have been seen and deliberately excluded.
    expect(archivedReferenced.length).toBeGreaterThan(0);
    expect(missing).toEqual([]);

    // `/archive` asks for exactly these keys. A new archived key rendered by
    // the 2026 block without a matching entry would silently fall back to its
    // JSX copy, so the registry is checked against the component here.
    expect([...new Set(archivedReferenced)].sort()).toEqual(
      [...VOTER_ARCHIVE_2026_DATA_POINT_KEYS].sort()
    );
  });

  it('asks Supabase for exactly those keys', async () => {
    const calls: unknown[][] = [];
    const builder = {} as Record<string, unknown>;
    for (const method of ['select', 'in']) {
      builder[method] = vi.fn((...args: unknown[]) => {
        calls.push([method, ...args]);
        return builder;
      });
    }
    builder.then = (resolve: (value: { data: { key: string; value: string }[] }) => unknown) =>
      Promise.resolve({
        data: [{ key: 'voter.hero.title', value: 'Voter Information & Guides' }],
      }).then(resolve);
    createPublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    const map = await getDataPointsForKeys(VOTER_INFO_DATA_POINT_KEYS);

    expect(calls).toContainEqual(['in', 'key', [...VOTER_INFO_DATA_POINT_KEYS].sort()]);
    expect(calls.some(([method]) => method === 'eq')).toBe(false);
    expect(map).toEqual({ 'voter.hero.title': 'Voter Information & Guides' });
  });

  beforeEach(() => {
    createPublicClient.mockReset();
  });
});
