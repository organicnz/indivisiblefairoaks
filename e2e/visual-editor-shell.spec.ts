import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const ADMIN_EMAIL = Bun.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = Bun.env.E2E_ADMIN_PASSWORD;

/**
 * Browser coverage for the visual editor shell's keyboard model.
 *
 * The seeded account is a real session but is not granted admin on the shared
 * project, and granting it is a database change this suite must not make. This
 * test therefore mocks only the admin-context response in the browser. It
 * exercises native key delivery, focus movement, and the tab/panel wiring; it
 * does not replace the server-side authorization tests.
 */
test.describe('visual editor shell', () => {
  test.beforeEach(() => {
    test.skip(
      !ADMIN_EMAIL || !ADMIN_PASSWORD,
      'set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run'
    );
  });

  test('editor-view tabs are keyboard operable and wired to their panels', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/login?next=/');
    await page.locator('#auth-tab-password').click();
    await page.locator('#login-email').fill(ADMIN_EMAIL as string);
    await page.locator('#login-password').fill(ADMIN_PASSWORD as string);
    await page.getByRole('button', { name: /^authenticate$/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });

    await page.route('**/api/admin/edit-context**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ isAdmin: true, target: null }),
      })
    );

    await page.goto('/?visual-edit=1');

    const sidebar = page.getByTestId('visual-edit-overlay');
    await expect(sidebar).toBeVisible();

    const tablist = sidebar.getByRole('tablist', { name: 'Editor views' });
    await expect(tablist).toBeVisible();
    await expect(tablist).toHaveAttribute('aria-orientation', 'horizontal');

    const studio = sidebar.getByRole('tab', { name: 'Studio' });
    const blocks = sidebar.getByRole('tab', { name: 'Blocks' });
    const library = sidebar.getByRole('tab', { name: 'Library' });

    await expect(blocks).toHaveAttribute('aria-selected', 'true');
    await expect(blocks).toHaveAttribute('tabindex', '0');
    await expect(studio).toHaveAttribute('tabindex', '-1');

    for (const [id, label] of [
      ['composer', 'Studio'],
      ['blocks', 'Blocks'],
      ['library', 'Library'],
    ] as const) {
      await expect(sidebar.getByRole('tab', { name: label })).toHaveAttribute(
        'aria-controls',
        `sidebar-tab-${id}`
      );
      const panel = page.locator(`#sidebar-tab-${id}`);
      await expect(panel).toHaveAttribute('role', 'tabpanel');
      await expect(panel).toHaveAttribute('aria-labelledby', `sidebar-tab-button-${id}`);
    }

    await blocks.focus();
    await expect(blocks).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(library).toHaveAttribute('aria-selected', 'true');
    await expect(library).toHaveAttribute('tabindex', '0');
    await expect(blocks).toHaveAttribute('tabindex', '-1');
    await expect(library).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(studio).toHaveAttribute('aria-selected', 'true');
    await expect(studio).toHaveAttribute('tabindex', '0');
    await expect(library).toHaveAttribute('tabindex', '-1');
    await expect(studio).toBeFocused();

    await page.keyboard.press('ArrowLeft');
    await expect(library).toHaveAttribute('aria-selected', 'true');
    await expect(library).toBeFocused();

    await page.keyboard.press('Home');
    await expect(studio).toHaveAttribute('aria-selected', 'true');
    await expect(studio).toBeFocused();

    await page.keyboard.press('End');
    await expect(library).toHaveAttribute('aria-selected', 'true');
    await expect(library).toBeFocused();

    // The inline context zone is a group, not a toolbar; only its nested
    // formatting strip is a toolbar. Open it from real page text, then cancel.
    await sidebar.getByRole('tab', { name: 'Blocks' }).click();
    await expect(blocks).toHaveAttribute('aria-selected', 'true');

    const missionParagraph = page
      .locator('main p')
      .filter({ hasText: 'The mission of the Fair Oaks-Carmichael chapter' })
      .first();
    await missionParagraph.click();

    const inlineGroup = sidebar.getByRole('group', {
      name: 'Direct in-place text editor controls',
    });
    await expect(inlineGroup).toBeVisible();
    await expect(
      inlineGroup.getByRole('toolbar', { name: 'Text formatting' })
    ).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(inlineGroup).toHaveCount(0);
    await expect(missionParagraph).not.toHaveAttribute('contenteditable', 'true');

    const results = await new AxeBuilder({ page })
      .include('[data-testid="visual-edit-overlay"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const serious = results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? '')
    );
    expect(
      serious.map((violation) => violation.id + ': ' + violation.help)
    ).toEqual([]);
  });
});

/**
 * The shell must stay closed to a visitor with no admin context, even when the
 * URL explicitly asks for visual-edit mode. This is the negative half of the
 * browser coverage; it needs no seed and runs in every environment.
 */
test.describe('visual editor access gate', () => {
  test('does not render the editor without an admin context', async ({ page }) => {
    await page.goto('/?visual-edit=1');
    await expect(page.locator('header')).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('visual-edit-overlay')).toHaveCount(0);
  });
});
