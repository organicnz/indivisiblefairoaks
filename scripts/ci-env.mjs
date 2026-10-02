/**
 * Declared contract for GitHub Actions configuration.
 *
 * Lives beside its only consumer (`check-ci-env.mjs`) rather than in `src/`,
 * because nothing in the application imports it and a `.ts` file pulled into a
 * plain node script forces type-stripping.
 *
 * This is the single inventory of everything the workflows expect to exist in the
 * repository's secrets/variables store. `scripts/check-ci-env.mjs` diffs it against
 * what the workflow files actually reference, so drift fails at commit time rather
 * than at 3am when a job starts and `${{ secrets.X }}` silently expands to empty.
 *
 * ## Why this exists
 *
 * Nothing documented the required set. `supabase/functions/env.example.md`
 * documents the *edge function* contract, not the Actions one, so onboarding
 * meant reading four workflow files. Worse, there was nothing to catch the
 * reverse case: a secret renamed in the dashboard and not in YAML produces no
 * error at commit time — the step just runs with an empty value and fails
 * somewhere unrelated.
 *
 * ## secrets vs vars
 *
 * A `NEXT_PUBLIC_*` value is inlined into the client bundle by Next.js and is
 * readable by every visitor. It is configuration, not a credential, and belongs
 * in *variables*. That distinction is not cosmetic: repository secrets are not
 * exposed to `pull_request` runs from forks, so a value stored as a secret
 * arrives empty on any fork PR. See `.github/workflows/ci.yml`.
 */

export const VARIABLES = {
  /** Canonical origin. Drives metadataBase, canonicals, sitemap, robots. */
  NEXT_PUBLIC_SITE_URL: {
    required: true,
    example: 'https://test.indivisiblefairoaks.org',
    note: 'The apex at cutover; the staging host before it.',
  },
  NEXT_PUBLIC_SUPABASE_URL: {
    required: true,
    example: 'https://<project-ref>.supabase.co',
  },
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: {
    required: true,
    example: 'sb_publishable_…',
    note: 'Anon-role key. Safe in vars, not secrets — it is shipped to the browser.',
  },
  SUPABASE_PROJECT_REF: {
    required: true,
    example: '<project-ref>',
  },
  /** Vercel project identity. Public identifiers from the dashboard, never
   * credentials. Let the secret audit address the project through the REST
   * API instead of depending on `vercel link` state that cannot exist on a
   * runner (and on a CLI that cannot run there). */
  VERCEL_PROJECT_ID: {
    required: true,
    example: 'prj_…',
  },
  VERCEL_ORG_ID: {
    required: true,
    example: 'team_…',
  },
};

export const SECRETS = {
  /** Supabase Management API PAT — deploys edge functions, applies migrations. */
  SUPABASE_ACCESS_TOKEN: {
    required: true,
    note: 'Personal access token, account-scoped. Create under Supabase → Account → Access Tokens.',
  },
  /** Direct Postgres password, used with the pooler for advisory-lock migrations. */
  SUPABASE_DB_PASSWORD: {
    required: true,
    note: 'The database role password, not the pooler password.',
  },
  /** Supavisor connection string. */
  SUPABASE_POOLER_URL: {
    required: true,
    // Deliberately not a copy-pasteable URL. A realistic-looking connection
    // string in a repo is both a false positive for the no-secrets guard (which
    // pattern-matches credentials) and a bad thing to have sitting on disk.
    example: 'Dashboard -> Connect -> Connection string -> URI, port 6543 (pooler)',
  },
  /** New-style service-role key. Grants full RLS-bypass on the database. */
  SUPABASE_SECRET_KEY: {
    required: true,
    note: 'Full bypass of RLS. walle-refresh only — never expose to the client.',
  },
  /** Fine-grained PAT for the self-hosted runner fleet. */
  RUNNERS_TOKEN: {
    required: false,
    note: 'Falls back to GITHUB_TOKEN. Needed only for runner-management API calls that the default token cannot make.',
  },
  /**
   * Vercel deploy token. Held in the repository since 2026-09-04 with no
   * consumer, which is the state the secret audit was built to surface: a
   * credential in a store, referenced by nothing, discoverable only by reading
   * the dashboard. `.github/workflows/secret-audit.yml` is that consumer — it
   * is the only way to read the Vercel environment, and Vercel is the one store
   * that actually serves requests.
   */
  VERCEL_TOKEN: {
    required: true,
    note: 'Needs project env read scope, or the audit reports the Vercel store as UNKNOWN.',
  },
  /**
   * Fine-grained PAT used only by the secret audit to list repository secrets
   * and variables. `GITHUB_TOKEN` cannot do this: the endpoint requires
   * repo-admin scope, which the default token never grants.
   *
   * Optional because its absence is not an outage — the audit reports the two
   * GitHub stores as UNKNOWN rather than clean, and reconciles Supabase and
   * Vercel regardless. That distinction is the whole point: an unreadable store
   * must never read as a passing one.
   */
  GH_AUDIT_TOKEN: {
    required: false,
    note: 'Fine-grained PAT, repository permissions limited to Actions -> Secrets: read. Read-only.',
  },
};

