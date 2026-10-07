/**
 * Ownership, exposure and blast radius for every credential in the project.
 *
 * ## Why this file exists
 *
 * The project has three declared contracts, each excellent at answering
 * "does the manifest agree with the code":
 *
 *   - `scripts/vercel-env.mjs`                 → Vercel project
 *   - `scripts/ci-env.mjs`                     → GitHub Actions
 *   - `supabase/functions/secrets.manifest.mjs` → Edge Functions
 *
 * Every one of them is **offline**. None of them can see a dashboard, so all
 * three prove the same narrow thing: the declared set matches what the source
 * reads. That is not the same question as "are the credentials actually there,
 * in the right store, classified correctly, and owned by someone".
 *
 * A live audit of all four stores on 2026-09-27 found that gap is not
 * theoretical. Every single class of drift the contracts were built to prevent
 * was present in production, and invisible to them:
 *
 *   - 3 of 4 `verify: true` edge secrets unset (`STRIPE_SECRET_KEY`,
 *     `STRIPE_WEBHOOK_SECRET`, `APP_URL`) → checkout and order fulfillment
 *     return 503 in production. The guard that would have caught this existed
 *     in `supabase.yml` but was **uncommitted**, so it had never run.
 *   - All three `NEXT_PUBLIC_*` values stored as GitHub **secrets** rather than
 *     variables. They ship in the client bundle, so they are public by
 *     construction, and repository secrets are withheld from `pull_request` runs
 *     from forks — so a fork PR builds against empty config. This is the exact
 *     failure `ci-env.mjs` documents in prose and `check-ci-env.mjs` claims to
 *     catch as rule 3. It could not catch it, because rule 3 only reads YAML.
 *   - `SUPABASE_PROJECT_REF` declared `required: true` in `VARIABLES` while the
 *     repository had **zero** variables set. Referenced by `supabase.yml`.
 *   - 12 secrets in the hosted edge project that no manifest declares and no
 *     function reads — including `GITHUB_TOKEN`, on a project where four
 *     functions are deployed `--no-verify-jwt` and therefore publicly callable.
 *
 * The common cause is not carelessness. It is that "is this secret still
 * needed, and who breaks if it leaks?" is not expressible in a name list, so it
 * is never asked. `GITHUB_TOKEN` is unread by anything, so every name-based
 * check classifies it as harmless — it is in fact pure attack surface, holding a
 * GitHub credential in a store that four unauthenticated public endpoints can
 * be deployed into.
 *
 * ## What this file is for
 *
 * It adds exactly the three axes the manifests lack, and deliberately owns
 * nothing else — every name and its required/optional status stays derived from
 * the three manifests, so there is no fourth list to drift out of sync.
 *
 *   1. `exposure`   — what a leak buys an attacker. Drives rotation urgency and
 *                     whether the value belongs in a `NEXT_PUBLIC_*` prefix at all.
 *   2. `owner`      — who is paged when it breaks or rotates. A secret with no
 *                     owner is an orphan and is treated as a finding.
 *   3. `expected`   — which stores the value is *supposed* to live in, so a
 *                     credential parked in the wrong store is detected rather
 *                     than merely duplicated.
 *
 * `scripts/secrets-audit.mjs` reconciles this file plus the three manifests
 * against the four live stores. It is read-only and has no mutation path; where
 * reality is wrong it prints the exact command to fix it and exits non-zero.
 */

/**
 * Blast radius, ordered by how bad a leak is. These are not severities of
 * "how important is this to us" — they are severities of "what does possession
 * of this value buy an attacker".
 */
export const EXPOSURE = {
  /**
   * Inlined into the client bundle by Next.js at build time. Readable by every
   * visitor with devtools, and logged in full by anyone who proxies the site.
   * Not a credential. Storing one behind a `NEXT_PUBLIC_` prefix is the failure
   * this level exists to catch.
   */
  public: 'public',

  /**
   * Server-side only, but possession is a working credential. Rotate on any
   * suspicion. Bounded blast radius: what it can reach is what the calling
   * service can reach.
   */
  server: 'server',

  /**
   * Grants control of an account, a database, or a deployment target — full
   * RLS bypass, an account-scoped PAT, a DNS zone, an email domain. Possession
   * is not "access to a feature", it is "access to everything downstream".
   * These are the values that make an audit finding an incident.
   */
  privileged: 'privileged',

  /**
   * No code path in the repository reads the value. It is not inert — it is
   * stored, in a store whose contents are readable by anyone with dashboard
   * access and by any function deployed into it, for no benefit. Pure liability.
   */
  unused: 'unused',
};

/**
 * Named human owners. A single-person chapter should route everything to one
 * owner rather than inventing roles that do not exist — the point is that every
 * value has a *name* attached, so an orphan is a visible state.
 */
/**
 * @type {Record<string, {id: string, label: string}>}
 */
export const OWNERS = {
  'repo-maintainer': { id: 'repo-maintainer', label: 'Repository maintainer (full env + deploy access).' },
  commerce: { id: 'commerce', label: 'Payments and order fulfillment. Stripe keys, order mail.' },
  platform: { id: 'platform', label: 'Hosting, DNS, CI and database provisioning.' },
  'edge-runtime': { id: 'edge-runtime', label: 'Edge Function runtime config. APP_URL, CORS, LLM keys.' },
  'app-runtime': { id: 'app-runtime', label: 'Values the Next.js app reads at build or request time.' },
  unowned: { id: 'unowned', label: 'UNASSIGNED — every finding against this is a defect.' },
};

/**
 * @typedef {Object} SecretMeta
 * @property {'public'|'server'|'privileged'|'unused'} exposure What a leak buys an attacker.
 * @property {{id: string, label: string}} owner Who is paged when it breaks or rotates.
 * @property {string[]} stores Every store the value is legitimately expected in.
 * @property {string} [note]
 * @property {string} [registryOnly] Why this is registered but declared in no manifest.
 * @property {boolean} [mustBeUnset] An unused credential that should be asserted absent.
 */

/**
 * How long each privileged value may live before a rotation is considered
 * overdue. Absent from the map means "no interval agreed" — never a silent 90.
 *
 * @type {Record<string, number>}
 */
export const ROTATION_INTERVALS = {
  STRIPE_SECRET_KEY: 90,
  STRIPE_WEBHOOK_SECRET: 90,
  RESEND_API_KEY: 180,
  RESEND_WEBHOOK_SECRET: 180,
  SUPABASE_SECRET_KEY: 90,
  SUPABASE_ACCESS_TOKEN: 90,
  SUPABASE_DB_PASSWORD: 90,
  VERCEL_TOKEN: 90,
  GH_AUDIT_TOKEN: 90,
  RUNNERS_TOKEN: 90,
};

/**
 * Every secret and config value the audit knows about, keyed by name.
 *
 * `stores` lists every store a value is legitimately expected in. More than one
 * is normal and correct: the same Stripe key is required in both the Vercel
 * project (for `/api/checkout`) and the edge project (for the `checkout` and
 * `webhook` functions), because they are two independent runtimes.
 *
 * A value found in a store not listed here is reported as `misfiled`. It is not
 * removed automatically — a credential in an unexpected place is often evidence
 * of the machine that needed it, and deleting a live credential is an outage.
 *
 * @type {Record<string, SecretMeta>}
 */
export const REGISTRY = {
  // ── Public configuration ─────────────────────────────────────────────────
  // Correctly in Vercel *Plain* and GitHub *Variables*. Exposure is `public`
  // because the value is in the client bundle, not because it is harmless to
  // publish — the prefix is the mechanism, and the audit enforces that any
  // `NEXT_PUBLIC_*` name is classified `public` and lives in a vars store.

  NEXT_PUBLIC_SITE_URL: {
    exposure: EXPOSURE.public,
    owner: OWNERS['app-runtime'],
    stores: ['vercel-var', 'github-var'],
    note:
      'The apex-cutover variable. A non-apex value makes the build emit ' +
      '`noindex, nofollow` site-wide, so a wrong value here is an SEO ' +
      'outage rather than an outage.',
  },
  NEXT_PUBLIC_SUPABASE_URL: {
    exposure: EXPOSURE.public,
    owner: OWNERS['app-runtime'],
    stores: ['vercel-var', 'github-var'],
  },
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: {
    exposure: EXPOSURE.public,
    owner: OWNERS['app-runtime'],
    stores: ['vercel-var', 'github-var'],
    note: 'Anon-role. Safe to publish *because* of what the RLS policies allow it to do.',
  },
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: {
    exposure: EXPOSURE.public,
    owner: OWNERS.commerce,
    stores: ['vercel-var'],
  },
  RESEND_FROM_EMAIL: {
    exposure: EXPOSURE.public,
    owner: OWNERS.commerce,
    stores: ['vercel-var', 'edge-secret', 'github-var'],
    note:
      'An address, not a credential. Readable in delivered mail headers, so it ' +
      'is not a secret even though it is operationally sensitive. Was held as a ' +
      'GitHub secret, which withheld it from fork PRs for no benefit.',
  },
  ADMIN_ORDER_EMAIL: {
    exposure: EXPOSURE.public,
    owner: OWNERS.commerce,
    stores: ['vercel-var', 'edge-secret', 'github-var'],
  },
  CONTACT_RATE_LIMIT_MAX: {
    exposure: EXPOSURE.public,
    owner: OWNERS['app-runtime'],
    stores: ['vercel-var'],
  },
  NEXT_PUBLIC_SENTRY_DSN: {
    exposure: EXPOSURE.public,
    owner: OWNERS['app-runtime'],
    stores: ['vercel-var'],
    note:
      'Error-monitoring DSN for the indivisiblefairoaks-web project. Public by ' +
      'construction — the client SDK ships it in the bundle. Deliberately NOT ' +
      'in github-var: CI and e2e builds carry no DSN so neither can file events ' +
      'against the production project, and adding it there would silently ' +
      're-enable exactly that.',
  },

  // ── Next.js server secrets ────────────────────────────────────────────────
  // Read only by the Node runtime. Never inlined, never in the bundle.

  SUPABASE_SECRET_KEY: {
    exposure: EXPOSURE.privileged,
    owner: OWNERS['repo-maintainer'],
    stores: ['vercel-secret', 'github-secret'],
    note:
      'Bypasses RLS on the entire database. Stored in GitHub *only* for the ' +
      'scheduled WALL-E refresh workflow, which is the single job scoped to hold ' +
      'it. Widening that scope makes the row-level security model decorative.',
  },
  STRIPE_SECRET_KEY: {
    exposure: EXPOSURE.privileged,
    owner: OWNERS.commerce,
    stores: ['vercel-secret', 'edge-secret'],
    note:
      'Two independent runtimes need it, so two copies are correct: the Next ' +
      'route handlers and the `checkout`/`webhook` functions. Missing from the ' +
      'edge store at audit time, which returns 503 from both functions.',
  },
  STRIPE_WEBHOOK_SECRET: {
    exposure: EXPOSURE.privileged,
    owner: OWNERS.commerce,
    stores: ['vercel-secret', 'edge-secret'],
    note:
      'The only thing distinguishing a real Stripe event from a forged one. The ' +
      'function it guards is deployed `--no-verify-jwt` and is therefore public. ' +
      'The code is fail-closed (`assertRuntimeConfig` runs before signature ' +
      'verification), so an absent value means events are rejected — not accepted ' +
      'unverified. Verified by reading the handler, not assumed.',
  },
  RESEND_API_KEY: {
    exposure: EXPOSURE.server,
    owner: OWNERS.commerce,
    stores: ['vercel-secret', 'edge-secret', 'github-secret'],
  },
  RESEND_WEBHOOK_SECRET: {
    exposure: EXPOSURE.server,
    owner: OWNERS.commerce,
    stores: ['vercel-secret'],
    note:
      'Verifies Resend delivery-event signatures on /api/webhooks/resend. ' +
      'Possession lets an attacker forge bounce/complaint events and suppress ' +
      'contacts (mailing-list DoS), but cannot unsuppress or read data — the ' +
      'route only ever sets do_not_email = true, never false.',
  },

  /**
   * Not a credential — a URL. Registered because the audit reconciles declared
   * config values too, and an undeclared one is how a deployment silently ends
   * up with a feature that cannot run. Server-only: it is read by
   * `src/lib/actions/crm.ts` and must never carry a NEXT_PUBLIC_ prefix, which
   * would ship the sender endpoint to every browser.
   */
  CRM_BROADCAST_FUNCTION_URL: {
    exposure: EXPOSURE.server,
    owner: OWNERS.platform,
    stores: ['vercel-var'],
    note:
      'Background broadcast sender. Absent, a chapter-wide send fails with an ' +
      'explicit "sender is not configured" error rather than delivering inside a ' +
      'request that cannot survive it. Must be set together with deploying the ' +
      'crm-broadcast-send edge function.',
  },

  // ── GitHub Actions ────────────────────────────────────────────────────────
  // Held only long enough to reach a runner. Anything here is one compromised
  // runner away from being public.

  SUPABASE_ACCESS_TOKEN: {
    exposure: EXPOSURE.privileged,
    owner: OWNERS.platform,
    stores: ['github-secret'],
    note:
      'Account-scoped PAT: deploys edge functions and applies migrations. Needs ' +
      'the `secrets read` scope or the hosted-project assertion cannot run.',
  },
  SUPABASE_DB_PASSWORD: {
    exposure: EXPOSURE.privileged,
    owner: OWNERS.platform,
    stores: ['github-secret'],
    note: 'The direct database role password, not the pooler password.',
  },
  SUPABASE_POOLER_URL: {
    exposure: EXPOSURE.privileged,
    owner: OWNERS.platform,
    stores: ['github-secret'],
    note:
      'Absent from the live repository at audit time, which is why migrations fell ' +
      'back to the Management API on an IPv6-only host. The fallback works, so the ' +
      'absence is a silent single-point-of-failure rather than a visible break.',
  },
  SUPABASE_PROJECT_REF: {
    exposure: EXPOSURE.public,
    owner: OWNERS.platform,
    stores: ['github-var'],
    note:
      'A project ref is a hostname, not a credential. Must be a *variable*: the ' +
      'deploy workflow needs it on fork PRs, where secrets are withheld.',
  },
  VERCEL_PROJECT_ID: {
    exposure: EXPOSURE.public,
    owner: OWNERS.platform,
    stores: ['github-var'],
    note:
      'A project identifier, not a credential. Must be a *variable*: the audit ' +
      'addresses the project through the REST API on runners where `vercel link` ' +
      'state cannot exist, and needs this to do so.',
  },
  VERCEL_ORG_ID: {
    exposure: EXPOSURE.public,
    owner: OWNERS.platform,
    stores: ['github-var'],
    note:
      'A team identifier, not a credential. Scopes the API read alongside the ' +
      'project ID for tokens that span multiple teams.',
  },
  VERCEL_TOKEN: {
    exposure: EXPOSURE.privileged,
    owner: OWNERS.platform,
    stores: ['github-secret'],
    note:
      'Vercel deploy token. Held in the repository from 2026-09-04 with no consumer ' +
      'until the live audit was built — a credential in a store, referenced by ' +
      'nothing, discoverable only by opening a dashboard. ' +
      '`.github/workflows/secret-audit.yml` is now that consumer: it is the only way to ' +
      'read the Vercel environment, and Vercel is the one store that serves requests.',
  },
  RUNNERS_TOKEN: {
    exposure: EXPOSURE.privileged,
    owner: OWNERS.platform,
    stores: ['github-secret'],
    note: 'Self-hosted runner fleet management. Falls back to `GITHUB_TOKEN`.',
  },
  /**
   * Read-only PAT whose only job is to let the audit *list* the GitHub stores.
   *
   * `GITHUB_TOKEN` cannot do this — the endpoint requires repo-admin scope — so
   * without this the two GitHub stores report UNKNOWN on every run. That is a
   * real and correct outcome, but it means half the audit is permanently blind,
   * and half-blind is how a drift goes unnoticed for months. Hence a dedicated
   * read-only credential rather than accepting the gap.
   */
  GH_AUDIT_TOKEN: {
    exposure: EXPOSURE.privileged,
    owner: OWNERS['repo-maintainer'],
    stores: ['github-secret'],
    note: 'Fine-grained PAT, scoped to Actions -> Secrets: read. Grants no write and no code access.',
  },
  /**
   * Build-time only. The Sentry Next.js plugin uploads source maps with it;
   * nothing at runtime — client, server or edge — may read it, which is why it
   * is absent from every schema and import graph. `next.config.ts` passes
   * `undefined` for e2e builds so an undeployed bundle never uploads.
   */
  SENTRY_AUTH_TOKEN: {
    exposure: EXPOSURE.privileged,
    owner: OWNERS.platform,
    stores: ['github-secret', 'vercel-secret'],
  },

  /**
   * Seeded credentials for the authenticated e2e suite.
   *
   * Two admin roles because the gates they exercise are mutually exclusive in
   * the product: the plain admin has no MFA factor, so `/admin` resolves; the
   * MFA admin has a verified TOTP factor, so an AAL1 session is bounced to
   * `/auth/mfa`. Before these existed, `/admin` and `/auth/mfa` had no browser
   * coverage at all.
   *
   * `privileged`, and deliberately so — possession is sign-in as an
   * administrator on the test project, which is full read/write on the CRM and
   * the order table. They must be credentials for a *test* Supabase project. A
   * production admin's password here would make the test suite a way to reach
   * production, and the suite has outbound network access on a shared runner.
   *
   * All five are optional. Both specs `test.skip` when they are absent rather
   * than weakening an assertion, so an unseeded repository runs the rest of the
   * suite unchanged. A skipped auth suite must never read as a passing one,
   * which is what the registry entries make visible in the audit.
   */
  E2E_ADMIN_EMAIL: {
    exposure: EXPOSURE.privileged,
    owner: OWNERS['repo-maintainer'],
    stores: ['github-secret'],
    note:
      'Non-MFA-enrolled admin on the test Supabase project. Enables ' +
      'e2e/admin-authenticated.spec.ts, which is the only browser coverage for ' +
      '/admin. `profiles.is_admin` must be true for this user.',
  },
  E2E_ADMIN_PASSWORD: {
    exposure: EXPOSURE.privileged,
    owner: OWNERS['repo-maintainer'],
    stores: ['github-secret'],
    note:
      'Password for E2E_ADMIN_EMAIL. Must not be enrolled in MFA: an AAL2 ' +
      'requirement would redirect the suite away from every admin route it ' +
      'means to drive.',
  },
  E2E_MFA_ADMIN_EMAIL: {
    exposure: EXPOSURE.privileged,
    owner: OWNERS['repo-maintainer'],
    stores: ['github-secret'],
    note:
      'Admin with one verified TOTP factor. Enables e2e/mfa-challenge.spec.ts, ' +
      'the only coverage of the step-up path — which no unit test can reach, ' +
      'because it depends on a real session whose AAL is set by GoTrue.',
  },
  E2E_MFA_ADMIN_PASSWORD: {
    exposure: EXPOSURE.privileged,
    owner: OWNERS['repo-maintainer'],
    stores: ['github-secret'],
    note: 'Password for E2E_MFA_ADMIN_EMAIL.',
  },
  /**
   * The base32 TOTP seed for `E2E_MFA_ADMIN_EMAIL`'s only factor.
   *
   * The one that looks least like a secret and is the most sensitive of the
   * five: it is a *current* credential for an admin account at every 30-second
   * step, and it has no expiry. A real enrollment reveals it exactly once, at QR
   * scan time, so it cannot be recovered later — hence seeding it rather than
   * capturing it. Anyone holding it can mint valid codes and read the CRM.
   */
  E2E_MFA_TOTP_SECRET: {
    exposure: EXPOSURE.privileged,
    owner: OWNERS['repo-maintainer'],
    stores: ['github-secret'],
    note:
      'Base32 secret of the MFA test factor. The spec derives each code locally ' +
      '(HMAC-SHA1 over the 30-second counter) — no provisioning service, no ' +
      'network call. Re-enrolling that factor invalidates this value.',
  },

  // ── Edge Function runtime ─────────────────────────────────────────────────
  // Injected as env vars into the Deno isolate. Reachable by every function in
  // the project, which is why four of them are deployed `--no-verify-jwt`.

  APP_URL: {
    exposure: EXPOSURE.server,
    owner: OWNERS['edge-runtime'],
    stores: ['edge-secret'],
    note:
      'CORS origin, Stripe return URLs, WALL-E citation URLs. Unset at audit ' +
      'time while the code still defaults it to the apex — which 302s to the ' +
      'legacy Google Site, so the default points citations at something that does ' +
      'not serve this app.',
  },
  ZAI_API_KEY: {
    exposure: EXPOSURE.server,
    owner: OWNERS['edge-runtime'],
    stores: ['edge-secret'],
  },
  GROQ_API_KEY: {
    exposure: EXPOSURE.server,
    owner: OWNERS['edge-runtime'],
    stores: ['edge-secret'],
  },
  WALLE_ZAI_MODEL: { exposure: EXPOSURE.public, owner: OWNERS['edge-runtime'], stores: ['edge-secret'] },
  WALLE_GROQ_MODEL: { exposure: EXPOSURE.public, owner: OWNERS['edge-runtime'], stores: ['edge-secret'] },
  WALLE_RATE_LIMIT_MAX: { exposure: EXPOSURE.public, owner: OWNERS['edge-runtime'], stores: ['edge-secret'] },
  WALLE_RATE_LIMIT_WINDOW_MIN: { exposure: EXPOSURE.public, owner: OWNERS['edge-runtime'], stores: ['edge-secret'] },
  SEARCH_RATE_LIMIT_MAX: { exposure: EXPOSURE.public, owner: OWNERS['edge-runtime'], stores: ['edge-secret'] },
  SEARCH_RATE_LIMIT_WINDOW_MIN: { exposure: EXPOSURE.public, owner: OWNERS['edge-runtime'], stores: ['edge-secret'] },
  SEARCH_RPC_TIMEOUT_MS: { exposure: EXPOSURE.public, owner: OWNERS['edge-runtime'], stores: ['edge-secret'] },

  /**
   * An *alternate authentication path* into a service-role-key function, which
   * nothing in this repository calls. It is listed here so the audit can assert
   * its **absence** — an unused credential that grants access to a
   * service-role-key function is exactly the thing that should never exist, and
   * "we checked and it is unset" is a stronger statement than silence.
   */
  WALLE_REFRESH_TOKEN: {
    exposure: EXPOSURE.privileged,
    owner: OWNERS['edge-runtime'],
    stores: [],
    mustBeUnset: true,
    note:
      'If this is ever set, it is a second way into a service-role-key function. ' +
      'Either document the caller that needs it or unset it.',
  },

  /**
   * Platform-injected. Present in the hosted project, absent from `secrets list`
   * by design — the platform sets them, not the operator. Declared so the audit
   * does not report them as unexpected.
   */
  SUPABASE_SERVICE_ROLE_KEY: {
    exposure: EXPOSURE.privileged,
    owner: OWNERS['edge-runtime'],
    stores: ['edge-platform', 'edge-secret'],
  },
  SUPABASE_URL: {
    exposure: EXPOSURE.public,
    owner: OWNERS['edge-runtime'],
    stores: ['edge-platform', 'edge-secret'],
    note: 'A hostname, not a credential. Present in the API surface by design.',
  },
  SUPABASE_ANON_KEY: {
    exposure: EXPOSURE.public,
    owner: OWNERS['edge-runtime'],
    stores: ['edge-platform', 'edge-secret'],
  },
  SUPABASE_JWKS: { exposure: EXPOSURE.public, owner: OWNERS['edge-runtime'], stores: ['edge-platform', 'edge-secret'] },
  SUPABASE_PUBLISHABLE_KEYS: { exposure: EXPOSURE.public, owner: OWNERS['edge-runtime'], stores: ['edge-platform', 'edge-secret'] },
  SUPABASE_SECRET_KEYS: { exposure: EXPOSURE.privileged, owner: OWNERS['edge-runtime'], stores: ['edge-platform', 'edge-secret'] },
};

/**
 * Values found in a live store that no manifest declares and no code reads.
 *
 * This is a **quarantine list, not a deletion list**. It exists so the audit
 * reports them as findings with a named owner instead of silently ignoring
 * them. Each entry was discovered by live audit on 2026-09-27.
 *
 * `GITHUB_TOKEN` is the one to act on first: a GitHub credential stored in the
 * Supabase edge secret store, on a project where `notify-contact`, `search`,
 * `webhook` and `health` are all deployed `--no-verify-jwt` and therefore
 * publicly callable. No function reads it, so nothing legitimate depends on it.
 *
 * @type {Record<string, {owner: {id: string, label: string}, severity: 'critical'|'high'|'medium'|'low', why: string}>}
 */
export const QUARANTINE = {
  GITHUB_TOKEN: {
    owner: OWNERS['repo-maintainer'],
    severity: 'critical',
    why:
      'A GitHub credential in the edge secret store. Four functions here are ' +
      'publicly callable; nothing reads this. Remove it.',
  },
  CRON_SECRET: {
    owner: OWNERS.platform,
    severity: 'high',
    why: 'Shared secret for scheduled invocation, read by no function. Either wire the verifier or remove it.',
  },
  CF_ACCESS_CLIENT_ID: {
    owner: OWNERS.platform,
    severity: 'medium',
    why: 'Cloudflare Access service credential, read by no function.',
  },
  CF_ACCESS_CLIENT_SECRET: {
    owner: OWNERS.platform,
    severity: 'high',
    why: 'Cloudflare Access service credential, read by no function. A secret half of a credential pair.',
  },
  CLOUDFLARE_API_TOKEN: {
    owner: OWNERS.platform,
    severity: 'medium',
    why: 'Present in both the edge store and GitHub. No workflow or function reads either copy.',
  },
  CLOUDFLARE_DNS_ZONE_TOKEN: {
    owner: OWNERS.platform,
    severity: 'high',
    why: 'DNS write token, read by no function. Can repoint the apex and the mail records.',
  },
  CLOUDFLARE_ZONE_ID: {
    owner: OWNERS.platform,
    severity: 'low',
    why: 'Zone identifier, not a credential, but undocumented in every manifest.',
  },
  LLM_PROVIDER: { owner: OWNERS['edge-runtime'], severity: 'low', why: 'Superseded by WALLE_* config. Read by nothing.' },
  LLM_DEFAULT_PROVIDER: { owner: OWNERS['edge-runtime'], severity: 'low', why: 'Superseded by WALLE_* config. Read by nothing.' },
  LLM_FALLBACK_PROVIDER: { owner: OWNERS['edge-runtime'], severity: 'low', why: 'Superseded by WALLE_* config. Read by nothing.' },
  OLLAMA_HOST: { owner: OWNERS['edge-runtime'], severity: 'low', why: 'Local inference host. Not reachable from hosted edge. Read by nothing.' },
  OLLAMA_MODEL: { owner: OWNERS['edge-runtime'], severity: 'low', why: 'Read by nothing.' },
  SUPABASE_DB_URL: {
    owner: OWNERS.platform,
    severity: 'high',
    why:
      'A direct Postgres connection string in the edge secret store. Unread, and ' +
      'a full-credential string sitting in a store four public functions share.',
  },
};

/**
 * @typedef {Object} StoreMeta
 * @property {string} label
 * @property {string} cli
 * @property {boolean} split Whether the platform separates public from private here.
 * @property {boolean|null} public True for the public half, false for private, null if neither.
 */

/** Every store the audit knows how to probe. @type {Record<string, StoreMeta>} */
export const STORES = {
  'vercel-var': { label: 'Vercel — Plain', cli: 'vercel env ls', split: true, public: true },
  'vercel-secret': { label: 'Vercel — Secret', cli: 'vercel env ls', split: true, public: false },
  'github-secret': { label: 'GitHub — Secrets', cli: 'gh secret list', split: true, public: false },
  'github-var': { label: 'GitHub — Variables', cli: 'gh variable list', split: true, public: true },
  'edge-secret': {
    label: 'Supabase — Edge secrets',
    cli: 'supabase secrets list',
    // Supabase has ONE edge secret store with no public/private distinction:
    // everything in it is injected as an env var into the Deno isolate. So
    // "this public value is in the secret store" is not a meaningful finding
    // there, and flagging it produces noise that trains people to ignore the
    // rule. The split exists only where the platform actually enforces it.
    split: false,
    public: null,
  },
  'edge-platform': { label: 'Supabase — platform-injected', cli: '(not settable)', split: false, public: null },
  local: { label: 'Local .env.local', cli: '(file)', split: false, public: false },
  vault: { label: 'Supabase Vault', cli: 'psql', split: false, public: false },
};

export const ALL_REGISTRY_NAMES = Object.keys(REGISTRY);
export const ALL_QUARANTINE_NAMES = Object.keys(QUARANTINE);
