// @vitest-environment node
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CURRENCY_CODE } from '@/config/commerce';

/**
 * No New Zealand dollar literals outside the historical record.
 *
 * The storefront once charged `nzd` while its structured data advertised `USD`,
 * and the edge `checkout` function carried the whole bug independently. The
 * currency itself is pinned by the product page's JSON-LD and `CURRENCY_CODE`,
 * but the same literals survived in the admin surfaces as well.
 *
 * This reads those files and asserts the literals are gone. It matches raw
 * content, comments included: none of the listed files has a legitimate reason
 * to mention NZD even in prose. The files that *do* — `commerce.ts`,
 * `products/[slug]/page.tsx`, `AGENTS.md`, the skill files — record why the
 * invariant exists and are deliberately not in the list.
 *
 * The order panels, admin order pages and Stripe scripts this list used to
 * cover were removed with the legacy checkout, so the list now names the
 * catalog and admin surfaces that remain.
 */
const APP_FILES = [
  'src/app/admin/customers/page.tsx',
  'src/app/admin/products/[id]/page.tsx',
  'src/app/admin/page.tsx',
  'src/app/shipping-returns/page.tsx',
];

async function sourceOf(relative: string): Promise<string> {
  return Bun.file(resolve(process.cwd(), relative)).text();
}

describe('commerce has no NZD residue', () => {
  it('uses USD as the storefront currency code', () => {
    expect(CURRENCY_CODE).toBe('USD');
  });

  it.each(APP_FILES)('%s mentions no NZD currency', async (relative) => {
    const source = await sourceOf(relative);
    expect(source, `${relative} still names NZD`).not.toMatch(/nzd/i);
  });

  it.each(APP_FILES)('%s mentions no NZPOST placeholder', async (relative) => {
    const source = await sourceOf(relative);
    expect(source, `${relative} still names NZPOST`).not.toMatch(/NZPOST/i);
  });

  it.each(APP_FILES)('%s mentions no en-NZ locale', async (relative) => {
    const source = await sourceOf(relative);
    expect(source, `${relative} still names en-NZ locale`).not.toMatch(/en-NZ/i);
  });

  it('defines no formatNZD helper anywhere in src', async () => {
    const sources = (await Promise.all(APP_FILES.map(sourceOf))).join('\n');
    expect(sources).not.toMatch(/formatNZD/);
  });
});
