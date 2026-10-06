/**
 * Declared contract for Supabase **Edge Function** secrets.
 *
 * Edge function secrets are a third configuration store, separate from GitHub
 * Actions (see scripts/ci-env.mjs) and from anything in the repository:
 *
 *   - `supabase functions deploy` ships CODE ONLY. The deploy workflow in
 *     .github/workflows/supabase.yml never runs `supabase secrets set`.
 *   - Secrets are therefore set out-of-band, by hand, in the Supabase dashboard.
 *   - Nothing in CI can see them. The "Verify live edge functions" job probes each
 *     function, but every probe fails on a validation or method check that happens
 *     BEFORE any secret is read — a missing STRIPE_SECRET_KEY or ZAI_API_KEY
 *     passes verification green and fails silently for users at runtime.
 *
 * `scripts/check-edge-secrets.mjs` keeps this manifest honest against the code
 * and against `env.example.md`; the deploy workflow additionally asserts every
 * `operator` secret is actually present in the hosted project.
 *
 * ## How to set them
 *
 *   supabase secrets set --project-ref <ref> KEY=VALUE …
 *
 * or Dashboard → Project Settings → Edge Functions → Secrets.
 *
 * ## Supabase Vault: not used
 *
 * Vault (`vault.decrypted_secrets`) is available on this project but nothing
 * queries it. Secrets here are injected as environment variables, which is the
 * right model at this size: every consumer is an edge function in this
 * repository, and the values must be readable at cold start without a query.
 * Vault would be worth revisiting if a *server-side* consumer ever needed a
 * secret — a Postgres function or trigger, say — because a function that only
 * reads env vars can never use it.
 */

/** Injected by the Supabase platform; not settable, not listed by `secrets list`. */
export const PLATFORM_INJECTED = {
  SUPABASE_URL: 'Project API URL.',
  SUPABASE_ANON_KEY: 'Anon-role key.',
  SUPABASE_SERVICE_ROLE_KEY: 'Service-role key. Bypasses RLS — never expose to a client.',
}

/**
 * New-style publishable/secret key formats, also platform-managed.
 *
 * These were missing from this manifest while being present in the hosted
 * project, which is how a store ends up with values nobody has written down.
 * The live audit found all three sitting in `secrets list` unread by any
 * function.
 *
 * The `not listed by secrets list` claim above is also wrong for this project:
 * `supabase secrets list` returns SUPABASE_URL, SUPABASE_ANON_KEY and
 * SUPABASE_SERVICE_ROLE_KEY. See scripts/secrets-registry.mjs, which expects
 * them in both buckets because that is what the store actually contains.
 */
export const PLATFORM_INJECTED_PLURAL = {
  SUPABASE_PUBLISHABLE_KEYS: 'Plural publishable-key set. Client-side, RLS-scoped.',
  SUPABASE_SECRET_KEYS: 'Plural secret-key set. Bypasses RLS — never expose to a client.',
  SUPABASE_JWKS: 'Signing keys for JWT verification. Public.',
}

/**
 * Operator-managed secrets, per function. `verify: false` marks a value the code
 * reads but tolerates being absent (a feature degrades rather than the function
 * failing). Anything `verify: true` must be present in the hosted project or the
 * deploy pipeline fails.
 */
export const FUNCTION_SECRETS = {
  // ── Cross-cutting ────────────────────────────────────────────────────────
  // Declared here rather than per-function because three functions read it and
  // the value must be identical across all of them (it is a CORS origin and a
  // URL prefix). It is currently mis-defaulted in code to the apex, which 302s
  // to the legacy Google Site — see env.example.md.
  _shared: {
    APP_URL: {
      verify: true,
      note:
        'CORS origin, Stripe success/cancel URLs, and WALL-E citation URLs. The code ' +
        "defaults to 'https://indivisiblefairoaks.org', which is wrong until cutover: the apex " +
        'redirects to the legacy Google Site, so every citation and return URL points ' +
        'somewhere that does not serve this app.',
    },
  },

  'notify-contact': {
    RESEND_API_KEY: { verify: true, note: 'Sends the contact notification. Absent → silent no-send.' },
    RESEND_FROM_EMAIL: { verify: false, note: 'Defaults in code.' },
    ADMIN_ORDER_EMAIL: { verify: false, note: 'Defaults in code.' },
  },
  checkout: {
    STRIPE_SECRET_KEY: { verify: true, note: 'Creates Checkout Sessions.' },
  },
  webhook: {
    STRIPE_SECRET_KEY: { verify: true, note: 'Reads events and issues refunds.' },
    STRIPE_WEBHOOK_SECRET: { verify: true, note: 'Verifies the Stripe signature. Absent → signature checks skipped.' },
    RESEND_API_KEY: { verify: true, note: 'Order confirmation email.' },
    RESEND_FROM_EMAIL: { verify: false, note: 'Defaults in code.' },
    ADMIN_ORDER_EMAIL: { verify: false, note: 'Defaults in code.' },
  },
  'crm-broadcast-send': {
    RESEND_API_KEY: {
      verify: true,
      note:
        'Delivers queued chapter broadcasts. Absent → the send fails immediately and the ' +
        'broadcast is marked failed rather than silently doing nothing. The GET health route ' +
        'returns { ready: false, missing: ["RESEND_API_KEY"] } when this is unset, so ' +
        'dispatchBroadcastSender() can surface the misconfiguration before queuing a send.',
    },
    RESEND_FROM_EMAIL: { verify: false, note: 'Defaults in code.' },
    ADMIN_ORDER_EMAIL: { verify: false, note: 'Reply-to and List-Unsubscribe mailto. Defaults in code.' },
    APP_URL: {
      verify: true,
      note:
        'Prefix for the per-recipient one-click unsubscribe URL. Defaults to the apex, which ' +
        '302s to the legacy Google Site — see the _shared note above. The GET health route ' +
        'returns { ready: false, missing: ["APP_URL"] } when this is unset, giving ' +
        'dispatchBroadcastSender() an early, actionable signal before any email is attempted.',
    },
  },
  search: {
    SEARCH_RATE_LIMIT_MAX: { verify: false, note: 'Defaults in code. Tuning, not a credential.' },
    SEARCH_RATE_LIMIT_WINDOW_MIN: { verify: false, note: 'Defaults in code.' },
    SEARCH_RPC_TIMEOUT_MS: { verify: false, note: 'Defaults in code.' },
  },
  'wall-e-chat': {
    ZAI_API_KEY: { verify: false, note: 'Primary model provider. Function degrades if absent.' },
    GROQ_API_KEY: { verify: false, note: 'Fallback provider. Function degrades if absent.' },
    WALLE_ZAI_MODEL: { verify: false, note: 'Model name, not a credential.' },
    WALLE_GROQ_MODEL: { verify: false, note: 'Model name, not a credential.' },
    WALLE_RATE_LIMIT_MAX: { verify: false, note: 'Defaults in code.' },
    WALLE_RATE_LIMIT_WINDOW_MIN: { verify: false, note: 'Defaults in code.' },
  },
  'walle-refresh': {
    WALLE_REFRESH_TOKEN: {
      verify: false,
      note:
        'ALTERNATE auth path (`x-walle-refresh-token`) for this function. The scheduled workflow ' +
        'authenticates with `Authorization: Bearer <service key>` instead, so nothing in this ' +
        'repository uses it. If it is set in the hosted project it is a second way into a ' +
        'service-role-key function: confirm it is unset, or document the caller that needs it.',
    },
  },
  health: {},
}

/** Secrets shared by more than one function, listed for the docs table. */
export const SHARED = {
  RESEND_API_KEY: ['notify-contact', 'webhook'],
  STRIPE_SECRET_KEY: ['checkout', 'webhook'],
  SUPABASE_SERVICE_ROLE_KEY: ['notify-contact', 'checkout', 'search', 'webhook', 'walle-refresh', 'wall-e-chat'],
}

/** Flat set of every operator-managed secret, for `supabase secrets list`. */
export const REQUIRED_IN_PROJECT = [
  ...new Set(
    Object.values(FUNCTION_SECRETS).flatMap((secrets) =>
      Object.entries(secrets)
        .filter(([, meta]) => meta.verify)
        .map(([name]) => name)
    )
  ),
];

/** Flat set of every name the code may read, for documentation completeness. */
export const ALL_NAMES = [
  ...Object.keys(PLATFORM_INJECTED),
  ...Object.keys(PLATFORM_INJECTED_PLURAL),
  ...new Set(Object.values(FUNCTION_SECRETS).flatMap((secrets) => Object.keys(secrets))),
];
