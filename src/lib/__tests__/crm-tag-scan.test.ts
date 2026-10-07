import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The cached half of the tag scan.
 *
 * `crm-reads.test.ts` covers the paging and the ceiling through the exported
 * action. This file pins the two properties of the cached wrapper itself: it
 * declares the `crm-tags` tag that `revalidateCRMRoutes()` invalidates (without
 * it, a CRM write would never refresh the chips), and it builds its own
 * service-role client rather than taking one as an argument (the cache key is
 * the arguments, and a client cannot be serialized).
 */

const cacheLife = vi.hoisted(() => vi.fn());
const cacheTag = vi.hoisted(() => vi.fn());
const createAdminClient = vi.hoisted(() => vi.fn());

vi.mock('next/cache', () => ({ cacheLife, cacheTag }));
vi.mock('@/lib/supabase-server', () => ({ createAdminClient }));

const { getCachedCRMTags } = await import('@/lib/crm-tag-scan');
const { createMockAdminClient } = await import('./supabase-mock');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getCachedCRMTags', () => {
  it('tags the entry so CRM writes invalidate it', async () => {
    createAdminClient.mockResolvedValue(
      createMockAdminClient({ crm_contacts: { rows: [{ id: 'c1', tags: ['choir'] }] } })
    );

    await getCachedCRMTags();

    expect(cacheTag).toHaveBeenCalledWith('crm-tags');
    expect(cacheLife).toHaveBeenCalledWith('hours');
  });

  it('scans through a service-role client it builds itself', async () => {
    createAdminClient.mockResolvedValue(
      createMockAdminClient({
        crm_contacts: {
          rows: [
            { id: 'c1', tags: ['choir', 'donor'] },
            { id: 'c2', tags: ['choir'] },
          ],
        },
      })
    );

    const result = await getCachedCRMTags();

    expect(createAdminClient).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ tags: ['choir', 'donor'], truncated: false, scanned: 2 });
  });
});
