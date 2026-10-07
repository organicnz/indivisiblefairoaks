import { cacheLife, cacheTag } from 'next/cache';
import { TAG_SCAN_LIMIT } from '@/lib/crm-limits';
import { createAdminClient } from '@/lib/supabase-server';

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

export type CRMTagScan = {
  tags: string[];
  /**
   * True when the ceiling stopped the scan, so `tags` may be incomplete.
   *
   * Distinct in meaning from a hidden tag in the composer: the 40-chip cap hides
   * a tag that *was* read and is selectable by typing, whereas this hides a tag
   * that was never read at all and cannot be found by any means.
   */
  truncated: boolean;
  /** Rows actually read. Compare against the ceiling to tell. */
  scanned: number;
};

/**
 * The distinct-tag scan itself, uncached and unauthenticated.
 *
 * Callers are responsible for authorization. `getCRMExistingTags` in
 * `actions/crm.ts` runs `requireAdmin()` and then reads through
 * `getCachedCRMTags` below.
 */
export async function scanCRMTags(adminClient: AdminClient): Promise<CRMTagScan> {
  const tags = new Set<string>();
  const PAGE = 1000;
  let scanned = 0;
  let exhausted = false;

  for (let offset = 0; offset < TAG_SCAN_LIMIT; offset += PAGE) {
    const { data, error } = await adminClient
      .from('crm_contacts')
      .select('tags')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) {
      throw new Error(`Failed to load tags: ${error.message}`);
    }
    if (!data || data.length === 0) {
      exhausted = true;
      break;
    }
    for (const row of data) {
      for (const t of row.tags || []) {
        if (t) tags.add(t);
      }
    }
    scanned += data.length;
    // A short page means the table ended, which is what separates "hit the
    // ceiling" from "read everything". Without it the two are indistinguishable
    // and `truncated` is always false.
    if (data.length < PAGE) {
      exhausted = true;
      break;
    }
  }

  const truncated = scanned >= TAG_SCAN_LIMIT && !exhausted;
  return { tags: [...tags].sort((a, b) => a.localeCompare(b)), truncated, scanned };
}

/**
 * The cached scan.
 *
 * It lives here, outside the `'use server'` module, and takes no arguments. That
 * is deliberate, and there are two reasons.
 *
 * 1. **Authorization cannot live inside a cache.** `'use cache'` used to sit on
 *    the exported `getCRMExistingTags` action, with `requireAdmin()` inside the
 *    cached body. On a cache hit the body never runs, so the admin check never
 *    ran either. The action is a server action, which means anyone can POST to
 *    it directly, and the cached tag list came back without a session check.
 *    (On a miss it was worse in a different way: `requireAdmin()` reads
 *    `cookies()`, which Next refuses inside `'use cache'`.) The fix is to check
 *    the caller first, outside the cache, and cache only the data.
 * 2. **The cache key is the arguments.** An admin client cannot be serialized,
 *    so this function builds its own service-role client. It reads no cookies,
 *    so the entry is the same for every admin, and the tags are the same for
 *    every admin, so that is correct.
 *
 * `revalidateCRMRoutes()` invalidates `crm-tags` on every CRM write.
 */
export async function getCachedCRMTags(): Promise<CRMTagScan> {
  'use cache';
  cacheLife('hours');
  cacheTag('crm-tags');
  return scanCRMTags(await createAdminClient());
}
