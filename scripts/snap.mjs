// Visual-regression capture for the token sweep.
//
// The design-system migration replaces raw Tailwind palette classes with design
// tokens. That is exactly the kind of change that is safe-looking in a diff and
// silently wrong on screen, so it must be verified with pixels, not assertions.
//
// Usage:
//   bun scripts/snap.mjs <label>          # writes .snapshots/<label>/<route>.png
//
// Routes cover both surface families: the dark civic pages and the light
// commerce/auth surfaces, so a token change that leaks across can be caught.
import { chromium } from '@playwright/test';
import { mkdir, rm } from 'node:fs/promises';

const LABEL = process.argv[2] ?? 'current';
const BASE = process.argv[3] ?? 'http://127.0.0.1:3115';
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
  '/account',
];

// Load .env.local so the pages that read Supabase render real content.
try {
  for (const line of (await Bun.file('.env.local').text()).split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  /* CI injects env instead */
}

if (await Bun.file(OUT).exists()) await rm(OUT, { recursive: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
let failures = 0;

for (const route of ROUTES) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    // Settle animations so a mid-transition frame cannot look like a regression.
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const name = route === '/' ? 'home' : route.replace(/\//g, '_').replace(/^_/, '');

  try {
    const res = await page.goto(`${BASE}${route}`, { waitUntil: 'load', timeout: 30_000 });
    // Let the VGPU canvases paint and images settle.
    await page.waitForTimeout(1200);
    if (route === '/gallery') {
      // The lightbox is the highest-risk surface on this page; capture it too.
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
    console.log(`  ${String(res?.status()).padStart(3)}  ${route} -> ${name}.png`);
  } catch (err) {
    failures += 1;
    console.log(`  ERR  ${route}  ${err.message.split('\n')[0]}`);
  } finally {
    await context.close();
  }
}

await browser.close();
console.log(`\n${failures ? `${failures} route(s) failed` : 'all routes captured'} -> ${OUT}/`);
