import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { GRANT_MARKER } from './helpers/e2e-seeds';

/**
 * Authenticated admin coverage. Seeded once per run through the site's own
 * password sign-in, then every admin surface asserts on the rendered page
 * instead of the login redirect.
 *
 * Requires E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD for a non-MFA-enrolled admin
 * user on the target Supabase project. Without them the whole suite skips —
 * admin browser coverage stays opt-in until that user exists, and nothing in
 * the gate silently weakens.
 */
const ADMIN_EMAIL = Bun.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = Bun.env.E2E_ADMIN_PASSWORD;
const STORAGE_STATE = path.join(import.meta.dirname, '.auth', 'admin.json');
/**
 * Opt-in for the one test that writes data.
 *
 * Staging and production share one Supabase project, so a test that creates and
 * deletes a `crm_contacts` row is writing to the real constituent directory. A
 * failure between create and delete leaves an `e2e-directory-*@example.com` row
 * behind. `isE2EMode()` stops sends, but nothing stops writes — so the write
 * test needs its own explicit switch, separate from the credentials that let the
 * read-only tests run. Set `E2E_ALLOW_DB_WRITES=1` only against a project where
 * that row is acceptable.
 */
const ALLOW_DB_WRITES = Bun.env.E2E_ALLOW_DB_WRITES === '1';

test.describe('admin surfaces with a seeded session', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run');

  // The setup project skips (rather than failing) when the seed lacks the
  // profiles grant, so the suite must skip too instead of failing on the
  // missing storage file. Runtime check, not load-time: workers load this
  // file before the setup project finishes.
  test.beforeEach(async () => {
    test.skip(
      await Bun.file(GRANT_MARKER).exists(),
      'seeded e2e-admin lacks the profiles grant — see the setup project output'
    );
  });

  /*
   * No beforeAll sign-in here. The session is written by e2e/auth.setup.ts
   * (the `setup` project in playwright.config.ts), because a beforeAll that
   * writes the file its own describe consumes via test.use cannot bootstrap:
   * when the file does not exist yet, fixture setup fails first and the
   * in-flight hook is cancelled silently, so every test reports a
   * storage-state ENOENT instead of whatever actually went wrong. The setup
   * project has no test.use, so its failures display as themselves.
   */
  test.use({ storageState: STORAGE_STATE });

  test('constituent directory renders for an admin', async ({ page }) => {
    await page.goto('/admin/crm');
    await expect(page).toHaveURL(/\/admin\/crm/);
    await expect(page.locator('body')).toContainText('Constituent Directory');
  });

  test('broadcast composer renders for an admin', async ({ page }) => {
    await page.goto('/admin/crm/broadcasts');
    await expect(page).toHaveURL(/\/admin\/crm\/broadcasts/);
    await expect(page.locator('body')).toContainText('Campaign Broadcasts');
  });

  /**
   * The one mutation every CRM surface is built on, driven through the editor
   * modal in a browser.
   *
   * `crm.test.ts` and `crm-mutations.test.ts` cover `saveCRMContact` against a
   * mocked client, which cannot see the two things that make the optimistic
   * concurrency guard work: that the modal actually sends the version it was
   * opened with, and that it adopts the version the response returns rather than
   * the one it arrived with. A regression in either is invisible to every unit
   * test here — the guard would simply never fire, or would fire against itself.
   *
   * Deleted at the end, so a re-run does not collide with the previous run's row
   * — the editor's own delete goes through `ConfirmAction`, so it is driven the
   * same way a person would.
   */
  test('a constituent can be created, edited and reloaded', async ({ page }) => {
    test.skip(
      !ALLOW_DB_WRITES,
      'writes a real crm_contacts row — set E2E_ALLOW_DB_WRITES=1 to run (see the note above)'
    );
    const stamp = `${Date.now()}`;
    const email = `e2e-directory-${stamp}@example.com`;

    await page.goto('/admin/crm');
    await page.getByRole('button', { name: /add constituent/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('#email').fill(email);
    await dialog.locator('#first_name').fill('E2E');
    await dialog.locator('#last_name').fill('Directory');
    await dialog.getByRole('button', { name: 'Create Constituent' }).click();

    // Landed in the table, addressed by the email rather than by row position —
    // a filter the suite set up could shift rows underneath an index.
    const row = page.getByRole('row').filter({ hasText: email });
    await expect(row).toBeVisible({ timeout: 15_000 });

    // Edit it and prove the write survived a reload, which is the property a
    // mocked client cannot demonstrate.
    await row.getByRole('button', { name: /^edit /i }).click();
    const editDialog = page.getByRole('dialog');
    await expect(editDialog).toBeVisible();
    await editDialog.locator('#city').fill('Carmichael');
    await editDialog.getByRole('button', { name: 'Save Changes' }).click();

    await page.reload();
    const reloaded = page.getByRole('row').filter({ hasText: email });
    await expect(reloaded).toBeVisible({ timeout: 15_000 });
    await expect(reloaded).toContainText('Carmichael');

    // Clean up. The delete lives on the constituent's own profile page, and goes
    // through `ConfirmAction` — so it is driven the same way a person would,
    // which is also what keeps the destructive path covered.
    await reloaded.getByRole('link', { name: /view 360/i }).click();
    await page.waitForURL(/\/admin\/crm\/[0-9a-f-]{36}$/i, { timeout: 15_000 });

    // The idle control is named for the person; the confirm step is the bare verb.
    await page.getByRole('button', { name: /^delete e2e directory$/i }).click();
    await page.getByRole('button', { name: /^delete$/i }).click();
    await expect(page.getByText(/deleted/i).first()).toBeVisible({ timeout: 15_000 });
  });

  /**
   * The directory's count and its keyboard-scrollable table.
   *
   * Both were broken in the same way: the count said one thing above the table
   * and another below it, and the table could not be scrolled sideways by a
   * keyboard user at all because `overflow-x-auto` is no longer focusable by
   * default. The focusable scroll region is the part a unit test cannot check.
   */
  test('the directory table is reachable and reports one consistent count', async ({ page }) => {
    await page.goto('/admin/crm');

    const table = page.getByRole('region', { name: /constituent directory/i });
    await expect(table).toBeVisible();

    // Focusable, and named — a bare `tabIndex` on a non-interactive element is a
    // focus trap with nothing to do.
    await expect(table).toHaveAttribute('tabindex', '0');

    // Exactly one readout, and it names a total rather than a page size.
    await expect(page.getByText(/Showing .* of .* constituents/i)).toHaveCount(1);
  });

  test('content editor renders for an admin', async ({ page }) => {
    await page.goto('/admin/content');
    await expect(page).toHaveURL(/\/admin\/content/);
    await expect(page.locator('body')).not.toContainText('Sign in');
  });

  test('admin CRM page has no serious axe violations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/admin/crm', { waitUntil: 'load' });
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const serious = results.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact ?? '')
    );
    expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

test.describe('unauthenticated redirects', () => {
  /**
   * These assertions need no seeded account — they create their own context
   * with no cookies — so a green run proved nothing when they sat inside the
   * `test.skip`-gated suite that requires `E2E_ADMIN_*` to be set.
   */
  test('an unauthenticated context still redirects', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/admin/crm');
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });
});
