/**
 * Declared contract for Vercel environment variables.
 *
 * This is the FOURTH and most consequential configuration store, and it was
 * entirely undocumented. There are three others:
 *
 *   1. GitHub Actions       → scripts/ci-env.mjs
 *   2. Supabase edge secrets → supabase/functions/secrets.manifest.mjs
 *   3. Supabase Vault        → not used (environment injection is correct at this size)
 *   4. Vercel                → this file
 *
 * Vercel is the one that actually serves requests, so a mistake here is a
 * production incident rather than a red pipeline. It is also the hardest to
 * audit from the repository: `vercel env ls` needs the CLI authenticated against
 * the project, which a checkout does not have. So the contract is declared here
 * and checked offline against the code by `scripts/check-vercel-env.mjs`.
 *
 * ## secrets vs vars in Vercel
 *
 * Vercel splits these explicitly, and the same rule as GitHub applies: a
 * `NEXT_PUBLIC_*` value is inlined into the client bundle at build time and is
 * readable by every visitor. It is configuration, not a credential, and belongs
 * under "Plain"/vars. Anything under "Secret" that is a NEXT_PUBLIC_* value has
 * been un-protected in the only sense that matters.
 *
 * The exposure surface is worth being precise about: the repository is private,
 * but the *built JavaScript* is served to the public. A Stripe secret key placed
 * under a `NEXT_PUBLIC_` prefix would be shipped to every browser. Nothing in
 * this manifest relies on a secret being non-`NEXT_PUBLIC_` by accident.
 */

export const VARS = {
  NEXT_PUBLIC_SITE_URL: {
    required: true,
    example: 'https://test.indivisiblefairoaks.org',
    note:
      'The canonical origin. Drives metadataBase, every canonical URL, og:url, ' +
      'sitemap.xml and robots.txt. A non-apex value makes the build emit ' +
      '`noindex, nofollow` site-wide. THIS IS THE APEX-CUTOVER VARIABLE.',
  },
  NEXT_PUBLIC_SUPABASE_URL: {
    required: true,
    example: 'https://<project-ref>.supabase.co',
  },
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: {
    required: true,
    example: 'sb_publishable_…',
    note: 'Anon-role. Shipped to the browser by design — safe as a var.',
  },
  // Server-only, not NEXT_PUBLIC_: only the Next server calls this.
  CRM_BROADCAST_FUNCTION_URL: {
    required: false,
    example: 'https://<project-ref>.supabase.co/functions/v1/crm-broadcast-send',
    note:
      'Background broadcast sender. Absent, a chapter-wide send fails with an ' +
      'explicit "sender is not configured" error rather than attempting delivery ' +
      'inside a request that cannot survive it. Set this together with deploying ' +
      'the crm-broadcast-send edge function.',
  },
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: {
    required: true,
    example: 'pk_live_…',
    note: 'Publishable counterpart to STRIPE_SECRET_KEY. Safe as a var.',
  },
  NEXT_PUBLIC_SENTRY_DSN: {
    required: true,
    example: 'https://<key>@o4509901022691328.ingest.de.sentry.io/<projectId>',
    note:
      'Sentry error monitoring for the indivisiblefairoaks-web project. Public ' +
      'by construction — the client SDK ships it in the bundle — so a var, ' +
      'never a secret. Absent, the SDK never initialises, which is how local ' +
      'dev and the CI/e2e builds stay quiet: neither may file events against ' +
      'the production project.',
  },
  RESEND_FROM_EMAIL: {
    required: true,
    example: 'contact@indivisiblefairoaks.org',
    note:
      'Must be on a domain with a published Resend DKIM record or DMARC fails. ' +
      'The apex SPF authorises Google only, so apex mail passes on DKIM alignment ' +
      'alone — a single point of failure. See docs/infrastructure-and-email-recovery-log.md §8.',
  },
  ADMIN_ORDER_EMAIL: {
    required: false,
    example: 'contact@indivisiblefairoaks.org',
    note: 'Where order notifications go. Defaults in code.',
  },
  CONTACT_RATE_LIMIT_MAX: {
    required: false,
    example: '3',
    note: 'Contact submissions per window, per IP. Defaults in code.',
  },
}

export const SECRETS = {
  SUPABASE_SECRET_KEY: {
    required: true,
    example: 'sb_secret_…',
    note:
      'Service-role key. Bypasses RLS on the entire database. Used by ' +
      'src/lib/supabase-server.ts for every server-side read. This is the single ' +
      'most damaging value in the repository — a leak makes the row-level ' +
      'security model decorative.',
  },
  STRIPE_SECRET_KEY: {
    required: true,
    example: 'sk_live_…',
    note: 'Checkout sessions and refunds. src/app/api/checkout, src/app/api/webhooks/stripe.',
  },
  STRIPE_WEBHOOK_SECRET: {
    required: true,
    example: 'whsec_…',
    note:
      'Verifies the Stripe signature on incoming webhooks. If this is absent, ' +
      'src/app/api/webhooks/stripe/route.ts cannot distinguish a real event from ' +
      'a forged one.',
  },
  RESEND_API_KEY: {
    required: true,
    example: 're_…',
    note: 'Contact form delivery and order confirmation. src/lib/email.ts.',
  },
  RESEND_WEBHOOK_SECRET: {
    required: true,
    example: 'whsec_…',
    note:
      'Verifies Resend webhook signatures on /api/webhooks/resend. ' +
      'Absent, every delivery event is rejected with 400 and bounces never ' +
      'suppress — read via env.RESEND_WEBHOOK_SECRET, never process.env.',
  },
  SENTRY_AUTH_TOKEN: {
    required: true,
    example: 'sntryu_…',
    note:
      'Build-time only: the Sentry Next.js plugin uploads source maps with ' +
      'it during Vercel builds. Never inlined, never read by runtime code — ' +
      'its only reader is next.config.ts, which next.config callers outside ' +
      'src/ do not show to the offline checker, so this entry documents a ' +
      'deliberate exception to the "declared but unread" rule rather than ' +
      'drift. CI builds read their own copy from GitHub Secrets.',
  },
}

/**
 * Set only in CI, never in the Vercel project. Listed so a checker can assert
 * they are NOT configured in Vercel — a stray production value here would route
 * real contact submissions into a test harness.
 */
export const CI_ONLY = {
  NEXT_E2E_BUILD: 'Enables Playwright testing hooks in a production build.',
  CONTACT_SUBMISSION_TEST_MODE: 'Short-circuits contact delivery for e2e.',
  CONTACT_FUNCTION_URL: 'Points notifications at the e2e mock server.',
  NEXT_SKIP_ENV_VALIDATION: 'Bypasses Zod validation. Build-time only.',
}

export const ALL_VARS = Object.keys(VARS);
export const ALL_SECRETS = Object.keys(SECRETS);
