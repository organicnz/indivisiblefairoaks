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
      'e2e/**',
      'playwright/tests/**', // Playwright E2E tests run via `playwright test`, not vitest
    ],
    coverage: {
      provider: 'v8',

      // ── Scope ─────────────────────────────────────────────────────────────
      // Only the files that are realistically unit-testable without a live
      // Next.js runtime or Supabase connection. Vitest V8 only instruments
      // files that are actually imported during the test run, so this list
      // must reflect what has (or should have) test coverage.
      //
      // `src/lib/actions/crm.ts` and `src/lib/blocks/**` used to be absent from
      // this list, which is how a 1,600-line file holding every CRM mutation,
      // the dispatch, the rate limits and the e2e guard could sit outside the
      // 90% gate entirely. The blocks were the more expensive omission: the
      // serialized format they define is the thing `content.body` is made of,
      // so "the editor is covered" was true of the components and silent about
      // the model. Both are in now, and the threshold applies to them.
      //
      // Files excluded and why:
      //   src/types/**           — generated, not hand-written
      //   src/app/**             — pages/API routes need Next.js runtime (E2E)
      //   src/components/**      — UI components need browser rendering (E2E)
      //   src/lib/store/**       — Zustand stores are pure state, no logic
      //   src/lib/supabase*.ts   — SSR client init needs Next.js cookies/headers
      //   src/lib/settings-server.ts — requires live Supabase + unstable_cache
      //
      // `src/config/site.ts` and `src/lib/metadata.ts` DO import `@/lib/env`, which
      // parses process.env at module load. Their tests set
      // NEXT_SKIP_ENV_VALIDATION=1 (the switch env.ts already exposes for exactly
      // this) so the import is safe without a full .env.
      include: [
        'src/lib/sanitize.ts',
        'src/lib/blocks/parse.ts',
        'src/lib/blocks/serialize.ts',
        'src/lib/blocks/types.ts',
        'src/lib/crm-broadcast.ts',
        'src/lib/crm-import.ts',
        'src/lib/content.ts',
        'src/lib/trusted-links.ts',
        'src/lib/own-media.ts',
        'src/lib/utils.ts',
        'src/lib/validations.ts',
        'src/lib/metadata.ts',
        'src/lib/actions/settings.ts',
        'src/lib/actions/crm.ts',
        'src/lib/error-report.ts',
        'src/lib/crm-unsubscribe.ts',
        'src/config/commerce.ts',
        'src/config/site.ts',
        'src/config/routes.ts',
        'src/config/legacy-redirects.ts',
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
      // Expressed as globs rather than as a bare `branches: 90`. Vitest's
      // global number is checked against the *aggregate* over every included
      // file, so a per-file entry cannot lower it — adding a file with a
      // different character to the set moves the global ratio for everything
      // else. Naming both globs makes the split explicit and lets the stricter
      // number actually apply.
      //
      // Aligned with the lefthook pre-push coverage gate (90%).
      thresholds: {
        // Everything except `crm.ts`, which is on the ratchet below.
        '!src/lib/actions/crm.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },

        /**
         * `crm.ts` is on a ratchet, not the global bar.
         *
         * It is the one file in the include list that is a thin layer over a
         * network boundary rather than a pure module, and most of its remaining
         * uncovered branches are `?? 0` / `?? 'draft'` defences against columns
         * that are `NOT NULL` in the schema. They are worth keeping and are not
         * worth a test each, so the file sits at 76% branch rather than 90%.
         *
         * This is deliberately a floor rather than an exemption. Before this
         * entry the file was in no threshold at all — the include list did not
         * mention it — which is how a ceiling refusal stayed dead code and a
         * `created_by` column stayed unwritten while the pipeline stayed green.
         * Being measured at 76% and unable to fall is strictly better than being
         * invisible, and raising these numbers is a chore, not a negotiation.
         *
         * Achieved 2026-09-29: 88.55 statements / 76.2 branches / 100
         * functions / 93.6 lines.
         */
        'src/lib/actions/crm.ts': {
          statements: 88,
          branches: 76,
          functions: 100,
          lines: 93,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
