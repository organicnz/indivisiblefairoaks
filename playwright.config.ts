import { readFileSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Load .env.local without adding a dotenv dependency; CI injects real env instead.
try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
} catch {
  // No local env file — rely on ambient environment (CI).
}

const PORT = 3100;
const MOCK_PORT = 3101;
const includeOptionalMobileBrowsers = process.env.PW_MOBILE_BROWSERS === '1';

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
  retries: process.env.CI ? 1 : 1,
  // Ephemeral runner hosts have 2 vCPUs; 1 worker prevents severe CPU
  // contention, SwiftShader WebGL stalls, and teardown timeouts.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
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
      command: `bunx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/robots.txt`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        // Route contact notifications at the controllable mock so e2e can
        // assert real delivery-status UI without sending actual email.
        CONTACT_FUNCTION_URL: `http://127.0.0.1:${MOCK_PORT}/notify-contact`,
        CONTACT_SUBMISSION_TEST_MODE: '1',
        NEXT_E2E_BUILD: 'true',
        // The suite submits the form many times from one IP; keep prod's 3/10min out of the way.
        CONTACT_RATE_LIMIT_MAX: '1000',
      },
    },
    {
      command: `node scripts/mock-notify-contact.mjs ${MOCK_PORT}`,
      url: `http://127.0.0.1:${MOCK_PORT}/__health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
