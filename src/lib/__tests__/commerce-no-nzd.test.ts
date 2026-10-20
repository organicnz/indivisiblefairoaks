// @vitest-environment node
//
// This suite exercises node-side code: it reads files off disk, and it calls
// scripts that use Bun's file APIs. It has no DOM to work with.
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
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CURRENCY_CODE } from '@/config/commerce';

/**
 * No New Zealand dollar literals outside the historical record.
 *
 * The storefront once charged `nzd` while its structured data advertised `USD`,
 * and the edge `checkout` function carried the whole bug independently. The
 * currency itself is pinned by `commerce-parity.test.ts`, but that only covers
 * the two config modules — the same literals survived in the order panels, the
 * admin orders pages, the CSV export header, a fulfilment placeholder, and
 * several scripts (one of which, `sync_stripe.mjs`, would mint real Stripe
 * prices in NZD if ever run).
 *
 * This reads those files and asserts the literals are gone. It matches raw
 * content, comments included: none of the listed files has a legitimate reason
 * to mention NZD even in prose. The files that *do* — `commerce.ts`,
 * `products/[slug]/page.tsx`, `AGENTS.md`, the skill files — record why the
 * invariant exists and are deliberately not in the list.
 */
const APP_FILES = [
  'src/types/orders.ts',
  'src/components/account/MyOrdersPanel.tsx',
  'src/components/account/AdminOrdersPanel.tsx',
  'src/app/admin/orders/page.tsx',
  'src/app/admin/orders/[id]/page.tsx',
  'src/app/admin/customers/page.tsx',
  'src/app/admin/customers/[id]/page.tsx',
  'src/app/admin/products/[id]/page.tsx',
  'src/app/admin/coupons/page.tsx',
  'src/app/admin/page.tsx',
  'src/components/admin/OrdersExport.tsx',
  'src/components/admin/FulfilmentEditor.tsx',
];

const SCRIPT_FILES = [
  'scripts/sync_stripe.mjs',
  'scripts/reconcile_orders.mjs',
  'scripts/create_test_session.mjs',
  'scripts/test_webhook_local.mjs',
  'scripts/test_webhook_events.mjs',
  'scripts/test_webhook_live2.mjs',
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

  it.each(SCRIPT_FILES)('%s prices or fixtures nothing in NZD', async (relative) => {
    const source = await sourceOf(relative);
    expect(source, `${relative} still names NZD`).not.toMatch(/nzd/i);
  });

  it('defines no formatNZD helper anywhere in src', async () => {
    const sources = (await Promise.all(APP_FILES.map(sourceOf))).join('\n');
    expect(sources).not.toMatch(/formatNZD/);
  });
});
