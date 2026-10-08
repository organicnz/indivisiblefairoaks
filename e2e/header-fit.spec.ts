import { expect, test } from '@playwright/test';

/**
 * The header must never overflow horizontally.
 *
 * This exists because it has already happened twice. The nine-link navigation row
 * at `tracking-[0.2em]` (the AGENTS.md nav rule) needs roughly 1365px once the
 * logo and action cluster are laid out. At the `xl` breakpoint (1280px) that
 * pushed the account control to x=1365 — off-screen, and unclickable. Playwright
 * caught it as a click timeout, not as a layout assertion, which is the worst
 * possible signal.
 *
 * So it is asserted directly: at every width in the matrix, no element in the
 * header may extend past the viewport, and the document must not scroll
 * horizontally.
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
  for (const { name, width, height } of WIDTHS) {
    test(`fits the viewport at ${name} (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await page.waitForLoadState('load');
      await page.waitForTimeout(600);

      // One shape, always — a union here would leave every field possibly
      // undefined and TypeScript could not narrow it after the assert below.
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
            // A 1px tolerance absorbs sub-pixel layout rounding.
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

      expect(report.hasHeader, 'the page must render a <header>').toBe(true);
      // The document itself must not scroll sideways.
      expect(
        report.docScrollW,
        `document scrollWidth ${report.docScrollW} exceeds clientWidth ${report.clientW}`
      ).toBeLessThanOrEqual(report.clientW + 1);
      // And no header child may sit outside the viewport.
      expect(
        report.offenders,
        `elements outside the ${width}px viewport: ${JSON.stringify(report.offenders)}`
      ).toEqual([]);
    });
  }

  test('keeps the account entry reachable at every width', async ({ page }) => {
    test.slow();
    // The account control is either inline (xl+) or in the drawer. One of the two
    // must always be present and operable — never neither.
    for (const { name, width, height } of WIDTHS) {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await page.waitForLoadState('load');
      await page.waitForTimeout(400);

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
      // The drawer has an exit animation, so it is still in the DOM for a few
      // hundred milliseconds after Escape. Without waiting for the unmount, the
      // next iteration's `getByRole('dialog')` can match the *dying* drawer and
      // this test was intermittently flaky. Assert the teardown rather than
      // sleeping.
      await expect(
        page.getByRole('dialog', { name: 'Navigation menu' }),
        `drawer should close on Escape at ${name}`
      ).toHaveCount(0);
    }
  });

  test('nav labels never wrap to two lines', async ({ page }) => {
    // `tracking-[0.2em]` widened each label; at xl the two longest wrapped, which
    // is why the row moved to 2xl. This asserts the invariant that motivated it.
    await page.setViewportSize({ width: 1920, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForTimeout(600);

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
