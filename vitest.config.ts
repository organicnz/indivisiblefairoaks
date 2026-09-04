import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.trunk/**',
      '**/.next/**',
      'e2e/**', // Playwright instant-navigation guards run via `playwright test`, not vitest
    ],
    coverage: {
      provider: 'v8',

      // ── Scope ─────────────────────────────────────────────────────────────
      // Only the files that are realistically unit-testable without a live
      // Next.js runtime or Supabase connection. Vitest V8 only instruments
      // files that are actually imported during the test run, so this list
      // must reflect what has (or should have) test coverage.
      //
      // Files excluded and why:
      //   src/types/**           — generated, not hand-written
      //   src/app/**             — pages/API routes need Next.js runtime (E2E)
      //   src/components/**      — UI components need browser rendering (E2E)
      //   src/lib/store/**       — Zustand stores are pure state, no logic
      //   src/lib/supabase*.ts   — SSR client init needs Next.js cookies/headers
      //   src/lib/settings-server.ts — requires live Supabase + unstable_cache
      //   src/lib/env.ts         — Zod parse runs at module load; mock-hostile
      include: [
        'src/lib/sanitize.ts',
        'src/lib/utils.ts',
        'src/lib/validations.ts',
        'src/lib/actions/settings.ts',
        'src/lib/error-report.ts',
        'src/config/shipping.ts',
        'src/app/auth/callback/route.ts',
      ],

      // ── Reporters ─────────────────────────────────────────────────────────
      // text-summary : parsed by lefthook pre-push coverage gate
      // text         : per-file breakdown visible in terminal
      // lcov         : consumed by CI for PR coverage diff annotations
      // html         : local browser drill-down at coverage/index.html
      reporter: ['text-summary', 'text', 'lcov', 'html'],
      reportsDirectory: './coverage',

      // ── Thresholds ────────────────────────────────────────────────────────
      // These apply to the files explicitly listed in `include` above.
      // Aligned with the lefthook pre-push coverage gate (90%).
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
