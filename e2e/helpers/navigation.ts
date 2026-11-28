import { expect, type Page } from '@playwright/test';

/**
 * Navigate to a route and wait for the rendered document, not every subresource.
 *
 * `waitUntil: 'load'` is the wrong readiness boundary for this suite. The load
 * event waits for every image, font, iframe and third-party request, and on a
 * constrained runner one stalled request can hold a page for the whole test
 * timeout. That happened on 2026-11-27: `/choir` was a finished prerender, but
 * the a11y gate's two `load` waits consumed 180 seconds each and the eventual
 * failure named `goto` instead of the resource.
 *
 * `commit` returns when the response has committed. The assertions after this
 * helper are the actual contract — the main landmark and the page's h1 are
 * present, and every later locator auto-waits for whatever it needs. A route
 * that never renders now fails in seconds and names the route, rather than
 * spending the test budget waiting for a request no assertion depends on.
 *
 * `requireHeading: false` is for callers that record a missing h1 as a finding
 * (structure.spec.ts) instead of throwing at the navigation.
 */
/**
 * How long a committed route gets to put its shell on screen.
 *
 * This is the navigation budget, not the content budget. Playwright's 10-second
 * `expect` default is sized for an assertion about a page that has loaded; a
 * landmark that has not arrived yet is the navigation still in flight. On a
 * loaded runner that difference is not academic: in run 46120207279
 * (2026-11-28) the host ran at roughly 7× the 5.9-minute baseline, five pages
 * took 10–25 seconds to reach `main`, and every one of those five failures was
 * this wait — no landmark was missing. The routes were fine; the 10-second
 * budget described a quiet host. Giving the shell the same 20 seconds as the
 * navigation changes nothing about what is asserted: a page that never renders
 * still fails here, with the same message.
 */
const ROUTE_READY_TIMEOUT_MS = 20_000;

export async function gotoRoute(
  page: Page,
  path: string,
  options: { requireHeading?: boolean } = {}
): Promise<void> {
  await page.goto(path, { waitUntil: 'commit', timeout: ROUTE_READY_TIMEOUT_MS });
  await expect(page.locator('main')).toBeVisible({ timeout: ROUTE_READY_TIMEOUT_MS });
  if (options.requireHeading !== false) {
    await expect(page.locator('h1').first()).toBeVisible({ timeout: ROUTE_READY_TIMEOUT_MS });
  }
}

/**
 * Navigate and wait until the client router has booted.
 *
 * `load` does not imply hydration. A click on a Next `<Link>` that races the
 * router can be swallowed, leaving the URL on the page the test started from;
 * that is how the account-entry test failed after the a11y stall. The router
 * object is installed by the client bootstrap, after `commit` and before the
 * user can rely on any client-side navigation, so waiting for it makes these
 * click-driven tests deterministic without a timeout sleep.
 */
export async function gotoHydrated(page: Page, path: string): Promise<void> {
  await gotoRoute(page, path);
  await page.waitForFunction(
    () => Boolean((window as unknown as { next?: { router?: unknown } }).next?.router),
    undefined,
    { timeout: 20_000 }
  );
}
