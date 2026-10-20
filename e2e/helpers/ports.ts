/**
 * The ports the e2e suite uses.
 *
 * ## One source of truth
 *
 * `playwright.config.ts`, `e2e/contact.spec.ts` and `e2e/instant.spec.ts` all
 * need these numbers, and they used to each hard-code `3100` and `3101`. That
 * is three places to keep in step, and the step that matters — moving the
 * suite off a busy port — was the one nobody remembered to make.
 *
 * They now read them from here, and `playwright.config.ts` reads them from
 * here too, so the app's port and the mock server's port cannot drift apart.
 *
 * ## Why the port is configurable
 *
 * `reuseExistingServer` means a local run reuses whatever is already
 * listening on the port. That is a reasonable convenience, and it is also a
 * way for the suite to drive the *wrong application* without saying so — a
 * collision this repository actually hit, when another app on the same
 * machine held the port and the suite reported a locator timeout for an
 * element that app does not have.
 *
 * `E2E_PORT` makes the collision avoidable. A worktree of this repository
 * needs the same thing: two checkouts, two suites, one port.
 *
 * `e2e/global-setup.ts` makes an unavoidable collision *loud* — it proves the
 * server under test is serving this repository's build before any spec runs.
 */
export const E2E_PORT = Number(Bun.env.E2E_PORT ?? 3100);

/**
 * The mock notify server's port.
 *
 * It is always one above the app's, so the pair stays adjacent and the mock
 * never lands on the port the app uses.
 */
export const MOCK_PORT = E2E_PORT + 1;

/** The mock notify server's origin. */
export const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}`;

/** The app's origin. */
export const APP_URL = `http://localhost:${E2E_PORT}`;
