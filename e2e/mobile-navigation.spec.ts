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
    await expect(
      dialog.getByRole('link', { name: /Indivisible Fair Oaks/i }).first()
    ).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(dialog).toContainText('Quick Search');
    await page.keyboard.press('Escape');

    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  });

  test('keeps the mobile layout within the viewport in landscape', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/products');

    const report = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      headerClearance: getComputedStyle(document.documentElement).getPropertyValue(
        '--header-clearance'
      ),
    }));

    expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth + 1);
    expect(report.headerClearance).toContain('var(--safe-area-top)');
  });
});
