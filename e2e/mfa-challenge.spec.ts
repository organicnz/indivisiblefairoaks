import { expect, test } from '@playwright/test';
import { generateTotp, msRemainingInStep } from './helpers/totp';

/**
 * The step-up path, in a real browser.
 *
 * Nothing else covers this. `mfa-guard.test.ts` mocks the Supabase client and
 * asserts on the *decision*; it cannot observe that GoTrue actually upgrades the
 * session to AAL2 and that the destination gate then lets the page through. That
 * handshake is the whole feature, and it has had zero coverage — a regression
 * there produces a volunteer who signs in correctly and is then denied their own
 * account, with no error anywhere in the repository to explain it.
 *
 * Requires a seeded admin on the target Supabase project with one verified TOTP
 * factor. Without the four E2E_MFA_* values this suite skips rather than
 * weakening an assertion, so an unseeded project runs everything else unchanged.
 * A skipped suite is not a passing suite; treat it as an uncovered path.
 */
const EMAIL = process.env.E2E_MFA_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_MFA_ADMIN_PASSWORD;
const SECRET = process.env.E2E_MFA_TOTP_SECRET;

test.describe('MFA step-up challenge without a seeded session', () => {
  /**
   * No seeded account, no credential dependency: this describes the middleware
   * bounce and used to sit inside the `test.skip`-gated suite — where a green
   * run proved only that it had been *skipped*. That is precisely the failure
   * mode `docs/mfa.md` names, so it lives outside the skip and runs on every
   * invocation.
   */
  test('the challenge is not reachable without a session', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL });
    const fresh = await ctx.newPage();
    await fresh.goto('/auth/mfa');
    await expect(fresh).toHaveURL(/\/login/, { timeout: 15_000 });
    await ctx.close();
  });
});

test.describe('MFA step-up challenge', () => {
  test.skip(
    !EMAIL || !PASSWORD || !SECRET,
    'set E2E_MFA_ADMIN_EMAIL, E2E_MFA_ADMIN_PASSWORD and E2E_MFA_TOTP_SECRET to run'
  );

  test.beforeEach(async ({ page }) => {
    await page.goto('/login?next=/account?tab=settings');
    await page.locator('#auth-tab-password').click();
    await page.locator('#login-email').fill(EMAIL as string);
    await page.locator('#login-password').fill(PASSWORD as string);
    await page.getByRole('button', { name: /^authenticate$/i }).click();
  });

  /**
   * The gate must fire on the destination, not at the login form. Signing in
   * with a password on an MFA account succeeds and yields an AAL1 session; the
   * challenge is reached because `/account` requires AAL2, and it must come with
   * `?next=` intact so the volunteer lands back on the 2FA panel they asked for.
   */
  test('sign-in lands on the challenge and returns to the requested tab', async ({ page }) => {
    await page.waitForURL(/\/auth\/mfa/, { timeout: 20_000 });

    const challenge = page.getByRole('heading', { name: /security check/i });
    await expect(challenge).toBeVisible();
    await expect(page.locator('#code')).toBeVisible();

    // Not a spinner-only page: a slow device must see something to read.
    await expect(page.getByRole('button', { name: /verify & continue/i })).toBeVisible();
  });

  test('a valid code upgrades the session and the gated page renders', async ({ page }) => {
    await page.waitForURL(/\/auth\/mfa/, { timeout: 20_000 });

    // A code is only valid for the remainder of its 30-second window. Computing
    // one near the end of a step and then typing it races the expiry, which is a
    // flaky failure that looks like a product bug.
    const remaining = msRemainingInStep();
    test.skip(remaining < 5_000, 'too close to a code rollover to type reliably');
    await page.locator('#code').fill(generateTotp(SECRET as string));

    await page.getByRole('button', { name: /verify & continue/i }).click();
    await page.waitForURL(/\/account/, { timeout: 20_000 });

    // The session must be AAL2 now. If GoTrue wrote an AAL1 cookie anyway, the
    // `/account` gate sends the user straight back here and this times out —
    // which is exactly the failure the assertion is for.
    await expect(page).toHaveURL(/\/account\?tab=settings/);
    await expect(page.getByRole('heading', { name: /two-factor authentication/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  /**
   * A rejected code must say so, and must not navigate. The failure mode this
   * guards is silent: the form re-enables and the user cannot tell whether the
   * code was wrong, the factor changed, or the session expired.
   */
  test('a wrong code is reported and does not navigate', async ({ page }) => {
    await page.waitForURL(/\/auth\/mfa/, { timeout: 20_000 });

    const remaining = msRemainingInStep();
    test.skip(remaining < 5_000, 'too close to a code rollover to type reliably');

    // A neighbouring time step is inside GoTrue's accepted skew, so it cannot
    // stand in for a wrong code. Use a code for a step far enough away to be
    // rejected outright.
    const wrong = generateTotp(SECRET as string, -5);
    await page.locator('#code').fill(wrong);
    await page.getByRole('button', { name: /verify & continue/i }).click();

    const alert = page.locator('[role="alert"]');
    await expect(alert).toBeVisible({ timeout: 15_000 });
    await expect(alert).not.toBeEmpty();
    await expect(page).toHaveURL(/\/auth\/mfa/);
  });

  /**
   * The step-up gate protects `/account`, which holds another person's order
   * data for an admin. An AAL1 session must not render it even briefly.
   */
  test('an AAL1 session is denied the account surface', async ({ page }) => {
    await page.waitForURL(/\/auth\/mfa/, { timeout: 20_000 });

    // Try to return to the gated destination without answering the challenge.
    await page.goto('/account?tab=settings');
    await page.waitForURL(/\/auth\/mfa/, { timeout: 20_000 });
    await expect(page.locator('#code')).toBeVisible();
  });

  /**
   * A fault must be visible, not a loop. `listFactors` failing used to send the
   * user to /login, middleware bounced them to /account, the gate sent them back
   * to /auth/mfa: four hops, nothing on screen saying why. The rendered fault is
   * what makes the failure recoverable, so its absence is the regression.
   */
  test('an unreadable MFA state renders a fault rather than redirecting', async ({ page }) => {
    await page.waitForURL(/\/auth\/mfa/, { timeout: 20_000 });

    // Every auth call on this page is against the project's GoTrue endpoint.
    // Failing it exercises the guard's fault branch without needing a fault in
    // Supabase itself.
    await page.route('**/auth/v1/**', (route) => route.abort('failed'));

    await page.reload();
    await expect(page.getByRole('heading', { name: /could not check your security status/i })) //
      .toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/auth\/mfa/);
  });
});

/**
 * The TOTP helper is a security-sensitive input: a wrong implementation would
 * make every assertion above pass or fail for the wrong reason. The RFC 6238
 * SHA-1 vectors are the reference, and they are asserted here rather than in a
 * unit test because the helper lives in `e2e/`, which vitest excludes.
 */
test.describe('TOTP helper against RFC 6238 vectors', () => {
  // "12345678901234567890" in base32. The RFC vectors are 8 digits; every
  // authenticator app uses 6, so the expected value is the last 6.
  const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  const VECTORS: [seconds: number, expected: string][] = [
    [59, '287082'],
    [1_111_111_109, '081804'],
    [1_111_111_111, '050471'],
    [1_234_567_890, '005924'],
    [2_000_000_000, '279037'],
    [20_000_000_000, '353130'],
  ];

  // A plain loop rather than `test.each`: Playwright's `each` is typed against a
  // tuple-inference that this build's `TestType` does not expose, so the
  // generated names lose their argument substitution anyway.
  for (const [seconds, expected] of VECTORS) {
    test(`matches the reference code at t=${seconds}`, () => {
      expect(generateTotp(RFC_SECRET, 0, seconds * 1000)).toBe(expected);
    });
  }

  test('reports the time left in the current step', () => {
    expect(msRemainingInStep(0)).toBe(30_000);
    expect(msRemainingInStep(29_999)).toBe(1);
    expect(msRemainingInStep(30_000)).toBe(30_000);
  });

  test('tolerates a lowercased, space-padded secret', () => {
    // A human copying a seed out of the dashboard routinely does this, and the
    // difference between working and "Invalid TOTP code" is invisible.
    expect(generateTotp('gezdgnbvgy3tqojq gezdgnbvgy3tqojq', 0, 59_000)).toBe('287082');
  });
});
