/**
 * Theme contrast audit — the dark half, per route.
 *
 * The light mode has the axe gate in e2e/a11y.spec.ts; this is its dark-mode
 * counterpart for the conversion sweep. A missing `dark:` variant is invisible
 * in a diff and in a screenshot, and axe is what names it.
 */
import { chromium } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3115';
const SCHEME = process.argv[3] ?? 'dark';

const ROUTES = [
  '/',
  '/about',
  '/events',
  '/voter-info',
  '/news',
  '/links',
  '/gallery',
  '/donate',
  '/faqs',
  '/choir',
  '/partners',
  '/contact',
  '/products',
  '/login',
  '/cart',
  '/wishlist',
  '/search?q=democracy',
];

try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  /* CI injects env instead */
}

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  reducedMotion: 'reduce',
  colorScheme: SCHEME,
});
const page = await context.newPage();

let total = 0;
for (const route of ROUTES) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  const results = await new AxeBuilder({ page })
    // The project's gate tags: WCAG 2.0/2.1 A + AA. `cat.color` is avoided
    // deliberately — it pulls in the AAA-enhanced rule (7:1), which the gate
    // does not enforce and which this palette does not claim.
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = results.violations.filter((v) =>
    ['serious', 'critical', 'moderate'].includes(v.impact ?? '')
  );
  if (serious.length > 0) {
    total += serious.length;
    console.log(`\n${route} — ${SCHEME}:`);
    for (const v of serious) {
      console.log(`  [${v.impact}] ${v.id}: ${v.nodes.length} node(s)`);
      for (const node of v.nodes.slice(0, 3)) {
        console.log(`      ${node.target.join(' ')} — ${node.failureSummary?.split('\n')[1] ?? ''}`);
      }
    }
  }
}

await browser.close();
console.log(`\n${SCHEME} audit done: ${total} violation group(s)`);
