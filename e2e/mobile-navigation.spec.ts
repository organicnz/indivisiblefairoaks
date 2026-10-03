import { expect, test } from '@playwright/test';

test.describe('mobile navigation contract', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true });

  test('traps focus, closes on Escape, and restores focus to the trigger', async ({ page }) => {
    await page.goto('/');

    const trigger = page.getByRole('button', { name: 'Open navigation menu' });
    await trigger.focus();
    await trigger.click();

    const dialog = page.getByRole('dialog', { name: 'Navigation menu' });
    await expect(dialog).toBeVisible();
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
    await expect
      .poll(() =>
        page
          .locator('#main-content')
          .evaluate(
            (element) =>
              element.getAttribute('aria-hidden') === 'true' || element.hasAttribute('inert')
          )
      )
      .toBe(true);
    // Focus must land INSIDE the dialog, not on any particular child. Radix
    // autofocuses the first tabbable node, which here is the close button — an
    // earlier version of this test asserted the logo link and failed for that
    // reason alone, while saying nothing about the trap itself.
    await expect(dialog.locator(':focus')).toHaveCount(1);

    // The substantive claim: Tab keeps focus in the drawer. Several presses, so
    // a trap that leaks only after the first cycle is still caught.
    for (let press = 0; press < 6; press += 1) {
      await page.keyboard.press('Tab');
      await expect(dialog.locator(':focus')).toHaveCount(1);
    }

    await page.keyboard.press('Escape');

    await expect(dialog).toHaveCount(0);
    // Focus returns to the control that opened the drawer, not to <body>.
    await expect(trigger).toBeFocused();
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  });

  test('keeps the mobile layout within the viewport in landscape', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/products');

    const report = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        headerH: style.getPropertyValue('--header-h'),
        headerClearance: style.getPropertyValue('--header-clearance'),
        safeAreaTop: style.getPropertyValue('--safe-area-top'),
      };
    });

    expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth + 1);

    // `--header-clearance` is `calc(var(--header-h) + var(--safe-area-top))`, so
    // the contract is that the clearance is BUILT FROM the header height.
    // Asserting the literal text `var(--safe-area-top)` cannot work: the CSSOM
    // resolves both references before a computed value is readable, so this
    // always comes back as `calc(6.5rem + 0px)`. Asserting the resolved form
    // still pins the arithmetic — if the clearance stopped deriving from
    // --header-h, the header height in it would disappear.
    expect(report.headerClearance).toContain(report.headerH);

    // No notch in this browser, so the inset resolves to its 0px fallback. That
    // is the environment, not the contract: the arithmetic above is what makes a
    // notched device clear the header, and it cannot be exercised here.
    expect(report.safeAreaTop).toBe('0px');
  });
});
