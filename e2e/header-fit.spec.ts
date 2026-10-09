import { expect, test } from '@playwright/test';

/**
 * The header must never overflow horizontally.
 *
 * PERF: Consolidated viewport tests to loop inside one test case. One
 * navigation to `/`, then `page.setViewportSize()` for each width — no
 * re-navigation needed. Saves ~15-25s of context + navigation overhead.
 */

const WIDTHS = [
  { name: 'iPhone SE', width: 320, height: 640 },
  { name: 'iPhone 12', width: 390, height: 844 },
  { name: 'iPad', width: 768, height: 1024 },
  { name: 'iPad Pro', width: 1024, height: 1366 },
  { name: 'laptop (xl)', width: 1280, height: 800 },
  { name: 'laptop (xl+)', width: 1366, height: 850 },
  { name: 'desktop (2xl)', width: 1536, height: 900 },
  { name: 'wide', width: 1920, height: 1080 },
];

test.describe('header layout', () => {
  test('fits the viewport at every width in the matrix', async ({ page }) => {
    test.slow();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load').catch(() => {});
    await page.waitForTimeout(300);

    const failures: { width: string; reason: string }[] = [];

    for (const { name, width, height } of WIDTHS) {
      await page.setViewportSize({ width, height });
      // Short settle — layout is already loaded, only reflowing.
      await page.waitForTimeout(150);

      const report = await page.evaluate(() => {
        const header = document.querySelector('header');
        const vw = window.innerWidth;
        const offenders: {
          tag: string;
          text: string;
          left: number;
          right: number;
        }[] = [];
        if (header) {
          for (const el of header.querySelectorAll('*')) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            if (r.right > vw + 1 || r.left < -1) {
              offenders.push({
                tag: el.tagName.toLowerCase(),
                text: (el.textContent ?? '').trim().slice(0, 30),
                left: Math.round(r.left),
                right: Math.round(r.right),
              });
            }
          }
        }
        return {
          hasHeader: Boolean(header),
          vw,
          docScrollW: document.documentElement.scrollWidth ?? 0,
          clientW: document.documentElement.clientWidth ?? 0,
          offenders: offenders.slice(0, 6),
        };
      });

      if (!report.hasHeader) {
        failures.push({ width: `${name} (${width}px)`, reason: 'no <header> rendered' });
        continue;
      }
      if (report.docScrollW > report.clientW + 1) {
        failures.push({
          width: `${name} (${width}px)`,
          reason: `scrollWidth ${report.docScrollW} > clientWidth ${report.clientW}`,
        });
      }
      if (report.offenders.length > 0) {
        failures.push({
          width: `${name} (${width}px)`,
          reason: `offenders: ${JSON.stringify(report.offenders)}`,
        });
      }
    }

    expect(failures, `header overflow at: ${JSON.stringify(failures, null, 2)}`).toEqual([]);
  });

  test('keeps the account entry reachable at every width', async ({ page }) => {
    test.slow();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load').catch(() => {});
    await page.waitForTimeout(300);

    for (const { name, width, height } of WIDTHS) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(100);

      const inline = page.getByRole('link', { name: /sign in/i });
      if (await inline.isVisible().catch(() => false)) {
        await expect(inline, `inline sign-in at ${name}`).toHaveAttribute('href', '/login');
        continue;
      }

      const trigger = page.getByRole('button', { name: 'Open navigation menu' });
      await expect(trigger, `drawer trigger at ${name}`).toBeVisible();
      await trigger.click();
      await expect(
        page
          .getByRole('dialog', { name: 'Navigation menu' })
          .getByRole('link', { name: /sign in/i }),
        `drawer sign-in at ${name}`
      ).toHaveAttribute('href', '/login');
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('dialog', { name: 'Navigation menu' }),
        `drawer should close on Escape at ${name}`
      ).toHaveCount(0);
    }
  });

  test('nav labels never wrap to two lines', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load').catch(() => {});
    await page.waitForTimeout(300);

    const wrapped = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Primary"]');
      if (!nav) return [];
      return [...nav.querySelectorAll('a')]
        .filter((a) => a.getBoundingClientRect().height > 32)
        .map((a) => a.textContent?.trim());
    });
    expect(wrapped).toEqual([]);
  });
});
