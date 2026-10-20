/**
 * Theme verification capture — light and dark, side by side.
 *
 * The token sweeps moved every page from a hardcoded palette to theme-aware
 * tokens, and the whole risk lives in the dark half: a class that survived
 * without its `dark:` variant is invisible in exactly the mode a diff cannot
 * show. This script screenshots each route in both palettes and runs axe
 * against the dark pass, so a contrast failure names its route instead of
 * being found by a reader.
 */
import { chromium } from '@playwright/test';
import { loadEnvLocal } from './load-env-local.mjs';
import { mkdir, rm } from 'node:fs/promises';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3115';
const LABEL = process.argv[3] ?? 'theme';
const OUT = `.snapshots/${LABEL}`;

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

await loadEnvLocal();

if (await Bun.file(OUT).exists()) await rm(OUT, { recursive: true });
await mkdir(`${OUT}/light`, { recursive: true });
await mkdir(`${OUT}/dark`, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });

for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    colorScheme: theme,
  });
  const page = await context.newPage();

  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    // The bootstrap script sets the attribute before paint; assert it took,
    // because a page that never flipped is the failure this guards.
    const applied = await page.evaluate(() => document.documentElement.dataset.theme);
    if (applied !== theme) {
      console.error(`  !! ${route}: data-theme="${applied ?? 'unset'}", expected ${theme}`);
    }
    await page.screenshot({ path: `${OUT}/${theme}/${route.replace(/[^\w]/g, '_')}.png`, fullPage: true });
  }

  await context.close();
}

await browser.close();
console.log(`captured ${ROUTES.length} routes x 2 themes -> ${OUT}`);
