import { readFileSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
import * as ports from './e2e/helpers/ports';

/**
 * Load `.env.local`, without a dotenv dependency; CI injects real env instead.
 *
 * **This is not redundant with Bun's own `.env` loading, and it is not dead
 * code.** Bun reads `.env`, `.env.local` and `.env.{NODE_ENV}` — but it does
 * so *at startup*, and it decides which files to read from the `NODE_ENV` that
 * is in the environment **at that moment**:
 *
 *   - `NODE_ENV` unset, `development`, `production`, `staging` → `.env.local`
 *     is read.
 *   - `NODE_ENV=test` → `.env.local` is **not** read; `.env.test` is read
 *     instead, and if there is no `.env.test` then neither is present.
 *
 * Playwright sets `NODE_ENV=test` inside its own code, which is too late to
 * change what Bun already loaded — so the usual local run does get
 * `.env.local` from Bun. But a shell that exports `NODE_ENV=test` sets it
 * *before* Bun starts, and then Bun reads neither, and this block is the only
 * thing standing between that developer and a suite that cannot reach
 * Supabase.
 *
 * `node:fs` rather than `Bun.file` on purpose: this has to be read
 * **synchronously**, before the config object is evaluated, and `Bun.file`
 * is asynchronous. `readFileSync` blocking for four kilobytes once, at
 * config load, is the right trade.
 *
 * That is also why this block does not call `scripts/load-env-local.mjs`:
 * that loader is asynchronous, and this one cannot be. The parsing rules are
 * the same — the shell's environment wins, and a quoted value means the value
 * *without* the quotes — and the loader's header says so.
 */
try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    // The shell's environment wins.
    if (process.env[match[1]]) continue;
    let value = match[2].trim();
    // A quoted value means the value without the quotes — the same rule
    // Bun's own `.env` parser applies, and the same one
    // `scripts/load-env-local.mjs` applies. Two of this repository's
    // `.env.local` values are quoted, and both are API credentials, so a
    // parser that kept the quotes would hand the next reader a token with
    // quote characters on the end.
    if (/^["'].*["']$/.test(value)) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
} catch {
  // No local env file — rely on ambient environment (CI).
}

// The port the suite drives, and the port the mock server listens on.
//
// Both come from `e2e/helpers/ports.ts`, which is the single source of
// truth: the config, `e2e/contact.spec.ts` and `e2e/instant.spec.ts` all
// need these numbers, and three hard-coded copies of a port is three places
// to keep in step.
//
// The helper chooses a free adjacent pair unless `E2E_PORT` is set, and the
// e2e build records its choice for this process. The suite therefore does not
// need a custom port to avoid the collision this repository actually hit:
// another application on this machine held 3100, Playwright reused it, and
// the suite drove the wrong product. It also no longer reuses a server at all
// (see `webServer` below), so a collision cannot silently become the target.
const { E2E_PORT: PORT, MOCK_PORT } = ports;

// A fresh checkout has no `.env.local`, and the e2e server runs `next start`
// without the placeholder values the build used (they are inlined for the
// client, not inherited by this process). Fill only the public values that are
// genuinely absent: a real `.env.local` or CI injection always wins. The
// loopback Supabase URL makes an unconfigured checkout fail fast instead of
// waiting on DNS, and the explicit marker lets live-only specs skip rather
// than treating a placeholder as a real deployment.
const placeholderEnv =
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const e2eDefaults: Record<string, string> = {
  NEXT_E2E_BUILD: 'true',
  NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'placeholder',
};
for (const [key, value] of Object.entries(e2eDefaults)) {
  if (!process.env[key]) process.env[key] = value;
}
if (placeholderEnv) process.env.E2E_PLACEHOLDER_ENV = '1';

const includeOptionalMobileBrowsers = Bun.env.PW_MOBILE_BROWSERS === '1';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  // 1 retry on both CI and local: with consolidated tests generating fewer
  // browser contexts and less swap pressure, a single retry catches genuine
  // race conditions. A third attempt (retries: 2) wasted up to 120s per flaky
  // test with no diagnostic value on the 887 MiB host.
  retries: Bun.env.CI ? 1 : 1,
  // Ephemeral runner hosts have 2 vCPUs; 1 worker prevents severe CPU
  // contention, SwiftShader WebGL stalls, and teardown timeouts.
  workers: Bun.env.CI ? 1 : undefined,
  reporter: Bun.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  // Prove the server under test is *this repository's* build before any spec
  // runs.
  //
  // A local run starts the server from the build in `.next` on a port the
  // helper verified is free; it never reuses whatever happens to be listening.
  // That removes the convenience that once let the suite drive a different
  // application, without requiring the caller to know a custom port.
  //
  // The check reads the build id out of `.next/BUILD_ID` and looks for it in
  // the served HTML, where Next writes it as `"b":"<id>"`. One marker answers
  // both questions that matter: *which* application is answering, and *which*
  // build of it.
  globalSetup: './e2e/global-setup.ts',
  projects: [
    // Writes e2e/.auth/admin.json for the suites that assert on rendered admin
    // surfaces. A setup project rather than a beforeAll hook: a hook that
    // writes the file its own describe consumes via test.use cannot bootstrap
    // itself (see e2e/auth.setup.ts).
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
    ...(includeOptionalMobileBrowsers
      ? [
          { name: 'webkit-mobile', use: { ...devices['iPhone 13'] }, dependencies: ['setup'] },
          {
            name: 'chromium-android',
            use: { ...devices['Pixel 7'] },
            dependencies: ['setup'],
          },
        ]
      : []),
  ],
  webServer: [
    {
      command: `bun --bun next start -p ${PORT}`,
      url: `http://localhost:${PORT}/robots.txt`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        // Route contact notifications at the controllable mock so e2e can
        // assert real delivery-status UI without sending actual email.
        CONTACT_FUNCTION_URL: `http://127.0.0.1:${MOCK_PORT}/notify-contact`,
        CONTACT_SUBMISSION_TEST_MODE: '1',
        NEXT_E2E_BUILD: 'true',
        // Pass the defaults into the server explicitly. `next start` is a
        // child process; relying on a parent-process mutation is an unnecessary
        // assumption when the values are already in hand.
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? '',
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
        E2E_PLACEHOLDER_ENV: process.env.E2E_PLACEHOLDER_ENV ?? '',
        // The suite submits the form many times from one IP; keep prod's 3/10min out of the way.
        CONTACT_RATE_LIMIT_MAX: '1000',
      },
    },
    {
      // Bun, not Node: the project has no Node runtime, and the mock server
      // is a Bun script. `node` here was a latent failure — the e2e gate
      // would spawn a missing binary and the webServer would never come up.
      command: `bun scripts/mock-notify-contact.mjs ${MOCK_PORT}`,
      url: `http://127.0.0.1:${MOCK_PORT}/__health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
