// Measures the colours actually painted on a page.
//
// The dark civic pages use standard Tailwind classes (`bg-slate-900`) while the
// design system defines equivalent tokens (`--secondary: #0f172a`). Whether that
// is a real problem depends on whether those classes resolve to the *same*
// colours — if they do, the sweep is churn; if they differ, there are visible
// seams between surfaces that are meant to match.
//
//   node scripts/palette.mjs <route> [base]
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const ROUTE = process.argv[2] ?? '/about';
const BASE = process.argv[3] ?? 'http://127.0.0.1:3115';

try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  /* CI injects env */
}

// Read the design tokens straight from the stylesheet so the comparison uses the
// same values the app ships.
const TOKENS = {
  'bg-secondary / --secondary': '#0f172a',
  'bg-surface-muted': '#f8fafc',
  'bg-primary / --primary': '#1e3a8a',
  'bg-primary-light': '#2563eb',
  'bg-primary-dark': '#172554',
  'bg-primary-bright': '#155dfc',
  'primary-on-dark': '#8ec5ff',
  'primary-on-dark-muted': '#50a2ff',
  'bg-accent / --accent': '#d97706',
  'bg-accent-gold': '#f59e0b',
  'text-ink-on-dark': '#cbd5e1',
  'text-ink-muted-on-dark': '#94a3b8',
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 2400 } });
await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'load' });
await page.waitForTimeout(1000);

const result = await page.evaluate(() => {
  // Tailwind v4 emits oklab()/oklch(), and Chrome reports those verbatim from
  // getComputedStyle. Parsing the string with a digit regex silently produces
  // garbage, so every colour is normalised through a 1x1 canvas instead.
  const probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  const ctx = probe.getContext('2d', { willReadFrequently: true });

  const toRGBA = (value) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000000';
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    return ctx.getImageData(0, 0, 1, 1).data;
  };

  const hex = (value) => {
    const [r, g, b, a] = toRGBA(value);
    if (a === 0) return null;
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
  };

  const bgs = new Map();
  const fgs = new Map();

  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const area = Math.round(r.width * r.height);

    const bg = hex(cs.backgroundColor);
    if (bg) bgs.set(bg, (bgs.get(bg) ?? 0) + area);

    if (el.textContent?.trim() && el.children.length === 0) {
      const fg = hex(cs.color);
      if (fg) fgs.set(fg, (fgs.get(fg) ?? 0) + area);
    }
  }

  return {
    backgrounds: [...bgs].sort((a, b) => b[1] - a[1]).slice(0, 14),
    foregrounds: [...fgs].sort((a, b) => b[1] - a[1]).slice(0, 12),
  };
});

// Luminance + contrast against the dominant surface, so near-duplicate navies
// are visible as "almost the same colour" rather than two unrelated hexes.
function lum(hexColor) {
  const n = hexColor.slice(1).match(/../g).map((h) => parseInt(h, 16) / 255);
  const f = n.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
}
function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return ((x + 0.05) / (y + 0.05)).toFixed(2);
}

const tokenHexes = Object.values(TOKENS);
console.log(`\n${ROUTE} — backgrounds by painted area\n`);
for (const [hex, area] of result.backgrounds) {
  const isToken = tokenHexes.includes(hex) ? ' <- TOKEN' : '';
  const nearest = tokenHexes
    .map((t) => [t, contrast(hex, t)])
    .sort((a, b) => Math.abs(+a[1] - 1) - Math.abs(+b[1] - 1))[0];
  const suffix = isToken ? ' <- TOKEN' : `   closest token ${nearest[0]} (contrast ${nearest[1]}:1)`;
  console.log(`  ${hex}  ${String(Math.round(area / 1000)).padStart(6)}k px2${suffix}`);
}

console.log(`\n${ROUTE} — foregrounds by painted area\n`);
for (const [hex, area] of result.foregrounds) {
  const isToken = tokenHexes.includes(hex) ? ' <- TOKEN' : '';
  console.log(
    `  ${hex}  ${String(Math.round(area / 1000)).padStart(6)}k px2${isToken}`
  );
}

// Report the total painted area that is NOT a token — the real size of the gap.
const totalBg = result.backgrounds.reduce((s, [, a]) => s + a, 0);
const offTokenBg = result.backgrounds
  .filter(([hex]) => !tokenHexes.includes(hex))
  .reduce((s, [, a]) => s + a, 0);
const totalFg = result.foregrounds.reduce((s, [, a]) => s + a, 0);
const offTokenFg = result.foregrounds
  .filter(([hex]) => !tokenHexes.includes(hex))
  .reduce((s, [, a]) => s + a, 0);

console.log(
  `\n  background off-token: ${((offTokenBg / totalBg) * 100).toFixed(1)}%` +
    `   foreground off-token: ${((offTokenFg / totalFg) * 100).toFixed(1)}%\n`
);

await browser.close();
