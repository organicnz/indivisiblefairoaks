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

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  // Local delivery gate (lefthook pre-push) gets 1 retry so known stream/layout
  // races do not block a green suite; CI keeps 2 for runner noise.
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
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
