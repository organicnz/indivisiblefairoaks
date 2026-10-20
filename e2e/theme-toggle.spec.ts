import { expect, test } from '@playwright/test';

/**
 * Theme toggle behaviour — system, light, dark, and the persistence between.
 *
 * The visual conversion is gated by `theme-a11y.spec.ts`; this spec guards the
 * control itself. Three properties carry the feature, and each has its own
 * failure mode that looks like nothing is wrong:
 *
 * 1. **The palette follows the OS until a pin is set.** The default state is
 *    `system`, so a reader who has never touched the control must see the
 *    palette their operating system asks for — and must keep seeing it *change*
 *    when the OS setting changes.
 * 2. **A pin overrides the OS and survives a reload.** localStorage is the
 *    store; a page that forgets it strands a reader back in `system`.
 * 3. **Choosing System withdraws the pin** rather than remembering "system" as
 *    a value, so the OS is consulted again.
 */

test.describe('theme toggle', () => {
  test('follows the OS setting by default and flips live', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.goto('/about');

    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');

    // The listener, not a reload: a reader changing their OS setting while the
    // page is open must see the palette follow.
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(22, 48, 92)');
  });

  test('cycles system → light → dark → system, pinning each', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.goto('/about');

    const toggle = page.getByRole('button', { name: /^Color theme:/ }).first();
    const html = page.locator('html');

    // OS asks for dark, so `system` paints dark. The first click pins light,
    // which is the one state that contradicts the OS setting.
    await expect(html).toHaveAttribute('data-theme', 'dark');

    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(238, 244, 255)');
    expect(await page.evaluate(() => localStorage.getItem('indivisible:theme-mode'))).toBe('light');

    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('indivisible:theme-mode'))).toBe('dark');

    // Back to system: the key is removed rather than set to 'system', so the
    // OS is consulted again — and here it still asks for dark.
    await toggle.click();
    await expect(toggle).toHaveAttribute('data-theme-mode', 'system');
    expect(await page.evaluate(() => localStorage.getItem('indivisible:theme-mode'))).toBeNull();
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });

  test('a pinned theme survives a reload and overrides the OS', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.goto('/about');

    await page
      .getByRole('button', { name: /^Color theme:/ })
      .first()
      .click();
    await page
      .getByRole('button', { name: /^Color theme:/ })
      .first()
      .click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // The OS still asks for light. The pin must win across a full reload — the
    // bootstrap script reads it before paint, so there is no light flash.
    await page.reload({ waitUntil: 'load' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(22, 48, 92)');
  });

  test('the drawer control and the header control stay in sync', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.goto('/about');

    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    const drawerToggle = page.getByRole('button', { name: /^Color theme:/ });
    await expect(drawerToggle).toHaveAttribute('data-theme-mode', 'system');
    await drawerToggle.click();

    // One click from system (with light effective) cycles to light (explicit pin).
    // The header's control reads the same store and stays in sync.
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('button', { name: /^Color theme:/ }).first()).toHaveAttribute(
      'data-theme-mode',
      'light'
    );
    await page.getByRole('button', { name: 'Close menu' }).click();
    await expect(page.getByRole('button', { name: /^Color theme:/ }).first()).toHaveAttribute(
      'data-theme-mode',
      'light'
    );
  });

  test('Shift+T global shortcut toggles theme and reveals the ThemeHud pill', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.goto('/about');

    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');

    // Press Shift+T on document
    await page.keyboard.press('Shift+KeyT');

    // ThemeHud should become visible with role="status"
    const hud = page.locator('aside[role="status"]');
    await expect(hud).toBeVisible();
    await expect(hud).toHaveClass(/opacity-100/);

    // Escape should dismiss the HUD immediately
    await page.keyboard.press('Escape');
    await expect(hud).toHaveClass(/opacity-0/);
  });

  test('ThemeHud allows switching modes directly using segmented buttons', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.goto('/about');

    // Open HUD via Shift+T
    await page.keyboard.press('Shift+KeyT');
    const hud = page.locator('aside[role="status"]');
    await expect(hud).toBeVisible();

    // Click 'Dark' button inside HUD
    const darkBtn = hud.locator('button[data-theme-mode="dark"]');
    await darkBtn.click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('indivisible:theme-mode'))).toBe('dark');
  });
});
