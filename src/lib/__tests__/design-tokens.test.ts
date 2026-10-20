import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Admin and editor surfaces follow the reader's palette — no raw slate.
 *
 * The visual editor's section modals and the CRM/content admin surfaces were
 * hardcoded light (`bg-white`, `text-slate-700`, `border-slate-300`, …), so in
 * dark mode an admin got a blinding white dialog over a dark page. The sweep
 * moved every light-surface class to a design token (`bg-surface-card`,
 * `text-foreground`, `border-border`, …).
 *
 * This pins the sweep. It scans source, comments included: none of these files
 * has a legitimate reason to name a light slate even in prose.
 *
 * Deliberate exceptions, and why each one stays:
 * - `text-slate-300` / `text-slate-400` / `bg-white/<alpha>` / `text-white` on
 *   the editor dock, section pills and frames: editor chrome is an opaque
 *   `bg-secondary` surface in both modes by design, same as the site header.
 * - `bg-slate-700/800/900/950` and `border-slate-700/800`: the bulk-action bar,
 *   the Live Audience badge and the device frames in `DevicePreviewFrame` are
 *   dark chrome or a hardware depiction, not light UI.
 * - `placeholder-slate-400` in `CRMContactList.tsx`: the bulk bar's inputs on
 *   `bg-slate-800` — asserted separately below so it cannot spread.
 * - `emerald-*` / `amber-*` / `rose-*` / `blue-*` / `purple-*` status tints:
 *   deliberate design choice with no token equivalent (see AGENTS.md).
 */

const ROOTS = ['src/components/visual-edit', 'src/components/admin', 'src/app/admin'];

function tsxFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === '__tests__') continue;
        walk(full);
      } else if (entry.endsWith('.tsx')) {
        out.push(relative(process.cwd(), full));
      }
    }
  };
  walk(resolve(process.cwd(), root));
  return out.sort();
}

const SCANNED = ROOTS.flatMap(tsxFiles);

async function sourceOf(relative: string): Promise<string> {
  return Bun.file(resolve(process.cwd(), relative)).text();
}

/** Light-surface text: the dark-chrome pair is 300/400, everything at 500+ is light-only. */
const LIGHT_TEXT = /text-slate-([56789]\d\d)/;
/** Light hairlines: the deliberate dark-chrome borders are 700/800. */
const LIGHT_BORDER = /border-slate-(50|100|200|300|500|600)(?![\d])/;
/** Light fills: the deliberate dark fills are 700/800/900/950.
 *  Excludes opacity modifiers like `/10` (e.g., `bg-slate-500/10` is a status color, not a fill). */
const LIGHT_FILL = /bg-slate-(50|100|200|300|500|600)(?![\d/])/;
/** Any slate hover — the sweep left none, on either surface. */
const SLATE_HOVER = /hover:(bg|text|border|file)-slate-\d+/;
/** A bare `bg-white` — every deliberate white carries an alpha (`bg-white/10`). */
const BARE_WHITE = /bg-white(?![/\w-])/;

describe('admin and editor surfaces use tokens, not raw slate', () => {
  it('scans a non-empty surface', () => {
    expect(SCANNED.length).toBeGreaterThan(20);
  });

  it.each(SCANNED)('%s has no light-surface text', async (relative) => {
    expect(await sourceOf(relative), `${relative} names light slate text`).not.toMatch(LIGHT_TEXT);
  });

  it.each(SCANNED)('%s has no light hairline border', async (relative) => {
    expect(await sourceOf(relative), `${relative} names a light slate border`).not.toMatch(
      LIGHT_BORDER
    );
  });

  it.each(SCANNED)('%s has no light fill', async (relative) => {
    expect(await sourceOf(relative), `${relative} names a light slate fill`).not.toMatch(
      LIGHT_FILL
    );
  });

  it.each(SCANNED)('%s has no slate hover state', async (relative) => {
    expect(await sourceOf(relative), `${relative} names a slate hover`).not.toMatch(SLATE_HOVER);
  });

  it.each(SCANNED)('%s has no bare bg-white', async (relative) => {
    expect(await sourceOf(relative), `${relative} names a bare bg-white`).not.toMatch(BARE_WHITE);
  });

  it('keeps placeholder-slate-400 on the bulk bar and nowhere else', async () => {
    // The sources are read once, in parallel: `SCANNED.filter` cannot take an
    // async predicate, and awaiting inside it would filter on a Promise
    // (always truthy) rather than on the text.
    const sources = await Promise.all(SCANNED.map((relative) => sourceOf(relative)));
    const holders = SCANNED.filter((_, i) => /placeholder-slate-/.test(sources[i]));
    expect(holders).toEqual(['src/components/admin/crm/CRMContactList.tsx']);
    expect(await sourceOf('src/components/admin/crm/CRMContactList.tsx')).toMatch(
      /placeholder-slate-400/
    );
  });
});
