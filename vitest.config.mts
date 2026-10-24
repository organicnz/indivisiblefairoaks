import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The default is `node`, not `jsdom`, and that is a performance decision
    // with a measurement behind it.
    //
    // Vitest constructs a fresh environment **per test file**. jsdom's
    // construction dominated this suite: measured on the whole run, jsdom was
    // created 130 times for 127.66s of a 224.22s run — 63% of the tracked
    // time, and the single largest cost in the unit suite by a wide margin.
    //
    // The reason it was 130 times is that the environment was a global
    // default, and 130 of the 130 test files inherited it — including the
    // ~81 that never touch a DOM. Every one of those files paid a full jsdom
    // construction for a `document` it never used.
    //
    // So the classification is now **explicit per file**: every test file
    // declares `// @vitest-environment node` or `// @vitest-environment
    // jsdom` on its first line, and `scripts/hooks/vitest-environment.mjs`
    // refuses a file that declares neither. 81 files run in `node`; 49 that
    // need a DOM run in `jsdom`.
    //
    // The classification was not guessed. Every file was run under
    // `--environment=node` and the ones that failed — all of them on
    // `ReferenceError: document is not defined`, `window is not defined`,
    // `localStorage is not defined` or `DOMParser is not defined` — were
    // marked `jsdom`. The failure is loud, which is what makes the
    // classification safe: a file that turns out to need a DOM fails at the
    // first `document`, in every test in the file, rather than quietly
    // behaving differently.
    //
    // This default is therefore only a safety net for a file that has not
    // been classified yet — and the guard makes sure there is no such file.
    // `node` is the right net: it is the cheap environment, and a file that
    // needs a DOM says so loudly rather than slowly.
    environment: 'node',
    globals: true,
    fileParallelism: false,
    testTimeout: 20000,
    setupFiles: [],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.worktrees/**',
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
      // `src/lib/mfa.ts` and `src/lib/mfa-guard.ts` were in neither the include
      // list nor any threshold, despite each already having a dedicated suite.
      // That is the same omission class as `crm.ts`: a file holding the step-up
      // decision for every account-mutating action, measured by nothing. A suite
      // that exists is not a gate that runs.
      //
      // `src/config/site.ts` and `src/lib/metadata.ts` DO import `@/lib/env`, which
      // parses process.env at module load. Their tests set
      // NEXT_SKIP_ENV_VALIDATION=1 (the switch env.ts already exposes for exactly
      // this) so the import is safe without a full .env.
      include: [
        'src/lib/sanitize.ts',
        // Homepage gathering-card selection + calendar URL builder (issue #37).
        // Pure and fully covered, so it can only raise the aggregate.
        'src/lib/civic-events.ts',
        'src/lib/blocks/parse.ts',
        'src/lib/blocks/serialize.ts',
        'src/lib/blocks/types.ts',
        'src/lib/crm-broadcast.ts',
        'src/lib/crm-import.ts',
        'src/lib/content.ts',
        'src/lib/image-size.ts',
        'src/lib/trusted-links.ts',
        'src/lib/own-media.ts',
        'src/lib/utils.ts',
        'src/lib/validations.ts',
        'src/lib/metadata.ts',
        'src/lib/mfa.ts',
        'src/lib/mfa-guard.ts',
        // The consent→URL mapping that three call sites used to build by hand,
        // each of them getting it slightly wrong.
        'src/lib/crm-filters.ts',
        // Editorial-button target resolution (pure) plus its server-side
        // context helper. The API route itself is covered by E2E.
        'src/lib/edit-target.ts',
        'src/lib/edit-context.ts',
        'src/lib/crm-limits.ts',
        // The cached tag scan, split out of `crm.ts` so authorization runs
        // outside the cache. Measured so the split cannot hide the scan.
        'src/lib/crm-tag-scan.ts',
        // Webhook signature verification. Pinned to Svix's published vector.
        'src/lib/svix-signature.ts',
        // The base64 helpers the verifier and its neighbours use. Pure
        // functions over the Web platform's `atob`/`btoa`, with the one
        // behaviour difference between those and `Buffer.from` pinned by a
        // test rather than by a comment.
        'src/lib/base64.ts',
        'src/lib/safe-redirect.ts',
        // The two step-up and settings surfaces. `settings.ts` imports
        // `mfa-guard.ts`, so a change to a guard branch moves this file's number
        // too — they are measured together for that reason.
        //
        // `admin-auth.ts` holds the redirect-vs-throw decision `docs/mfa.md`
        // calls load-bearing: only `step_up_required` earns a redirect, a fault
        // throws. It was in no `include` entry — the same omission class as
        // `crm.ts` before it — so the decision nothing else pins was measured
        // by nothing.
        'src/lib/admin-auth.ts',
        'src/lib/actions/settings.ts',
        'src/lib/actions/content.ts',
        'src/lib/actions/content-media.ts',
        'src/lib/actions/crm.ts',
        'src/lib/error-report.ts',
        'src/lib/crm-unsubscribe.ts',
        'src/config/commerce.ts',
        // Order provider mappers (Stripe + future WooCommerce). Pure module,
        // measured so the seam cannot drift from the constraint it serves.
        'src/lib/commerce/orders.ts',
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
        // Everything except `crm.ts` and `content.ts`, which are on the
        // ratchets below.
        //
        // One glob, not two. Vitest treats each threshold key as its own
        // "all files not matching this" set, so `'!crm.ts'` *includes*
        // `content.ts` and vice versa — and each of those sets then fails on the
        // other file's floor. The exclusion has to be expressed once.
        '!src/lib/actions/{crm,content}.ts': {
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
         * worth a test each, so the file sits at 78% branch rather than 90%.
         *
         * This is deliberately a floor rather than an exemption. Before this
         * entry the file was in no threshold at all — the include list did not
         * mention it — which is how a ceiling refusal stayed dead code and a
         * `created_by` column stayed unwritten while the pipeline stayed green.
         * Being measured at 78% and unable to fall is strictly better than being
         * invisible, and raising these numbers is a chore, not a negotiation.
         *
         * Achieved 2026-09-29: 88.55 statements / 76.2 branches / 100
         * functions / 93.6 lines. Raised 2026-10-05 to 89.5 / 78.2 / 100 / 93.7
         * by the merge RPC's replacements (the arithmetic moved into plpgsql, so
         * those branches left the file) plus tests for the paged history read
         * and `markCRMBroadcastFailed`. Raised 2026-10-06 to 94.2 / 84 / 100 / 97.8
         * with broadcast-send type validation and tag query coverage.
         * Raised 2026-10-07 to 95.41 / 85.31 / 100 / 98.38 by covering the
         * `payload.warning` ternary branches in the dispatch json-parse path.
         */
        'src/lib/actions/crm.ts': {
          statements: 89,
          branches: 85,
          functions: 100,
          lines: 93,
        },

        /**
         * `content.ts` is on a ratchet too, from a much lower start.
         *
         * It is every CMS mutation — upload, delete, duplicate, status, save,
         * revisions — and it was in **no threshold at all**, which is the same
         * omission that hid `crm.ts` and is how a broadcast had never been sent
         * while the pipeline stayed green. Adding it to `include` immediately
         * put it at 53.57 / 50 / 53.84 / 59.71.
         *
         * The 50% is not a rounding artefact. Uncovered is most of the image
         * storage paths, the revision queries, the list/pagination reads and
         * every failure branch — most of which mock the network one layer down
         * and are covered by `content-media` / `content-revisions` instead.
         *
         * So this is a floor at the measured value, not an exemption: it is
         * now a number that can fail the build and can only rise. That is the
         * whole difference from being invisible, and it is the difference
         * between "we have not looked" and "we have looked, and here is the
         * number".
         *
         * Raised once already, from 53/50/53/59 to the figures below, when the
         * concurrent-edit and unsubscribe-route suites landed. A floor that is
         * not moved when the number moves is a comment, not a ratchet.
         *
         * Achieved 2026-09-30: 58.82 statements / 54.54 branches / 61.53
         * functions / 65.71 lines.
         *
         * Raised 2026-10-12 to 65 / 57 / 70 / 70: the first getContentList
         * suite (status/type/query filters with explicit paging) moved
         * branches 51.92 → 60.25. Branches sit tight because that metric is
         * what failed; the rest keep headroom.
         */
        'src/lib/actions/content.ts': {
          statements: 65,
          branches: 57,
          functions: 70,
          lines: 70,
        },

        /**
         * `content-media.ts` is a new actions module for the visual editor's
         * per-page media panel. It mirrors the `content.ts` pattern (pure
         * server actions with Supabase admin client) so the same 90% floor
         * applies — no ratchet needed since it's new code we can test fully.
         */
        'src/lib/actions/content-media.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },
      },
    },
  },
  resolve: {
    alias: {
      // `import.meta.dirname` rather than `__dirname`.
      //
      // This file is `.mts` so that Vite loads it as ESM. Vite's native
      // config loader — `configLoader: 'native'`, which Vite 8 makes the
      // default in a future major — reads the file's ESM syntax directly
      // instead of bundling it to CommonJS first. A `.ts` file in a package
      // without `"type": "module"` is loaded as CommonJS, and Vite warns
      // about exactly that on every run:
      //
      //     Your Vite config uses features that are unsupported by
      //     `configLoader: 'native'` … ESM syntax in a file loaded as
      //     CommonJS
      //
      // `.mts` is unambiguously ESM, and `import.meta.dirname` is the ESM
      // spelling of `__dirname` — which does not exist in an ES module, so
      // the alias would have been the next failure.
      //
      // `import.meta.dirname` is Bun 1.1+ and Node 20.11+. This repository
      // runs on Bun; the config is only ever read by Bun.
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
