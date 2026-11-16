// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createPublicClient = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase-server', () => ({ createPublicClient }));
vi.mock('@/lib/env', () => ({ env: { NEXT_E2E_BUILD: 'false' } }));
vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

const { getPublishedPosts } = await import('@/lib/queries/content');

describe('getPublishedPosts', () => {
  beforeEach(() => {
    createPublicClient.mockReset();
  });

  it('excludes reserved route rows and copy regions from the public news feed', async () => {
    const calls: unknown[][] = [];
    const builder = {} as Record<string, unknown>;

    for (const method of ['select', 'eq', 'or', 'order', 'limit']) {
      builder[method] = vi.fn((...args: unknown[]) => {
        calls.push([method, ...args]);
        return builder;
      });
    }
    builder.not = vi.fn((...args: unknown[]) => {
      calls.push(['not', ...args]);
      return builder;
    });
    builder.then = (resolve: (value: { data: never[] }) => unknown) =>
      Promise.resolve({ data: [] }).then(resolve);
    createPublicClient.mockReturnValue({ from: vi.fn(() => builder) });

    await getPublishedPosts(11);

    expect(calls).toContainEqual([
      'not',
      'slug',
      'in',
      expect.stringContaining('"newsletters"'),
    ]);
    expect(calls).toContainEqual(['not', 'slug', 'like', 'copy-%']);
    expect(calls).toContainEqual(['limit', 11]);
  });
});
