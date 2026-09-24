import { z } from 'zod';

// Public vars are validated in BOTH environments (they are inlined by Next.js
// into the client bundle). Server-only secrets are added to the schema on the
// server — they are never inlined, so a client import must not reference them.
const isClient = typeof window !== 'undefined';
const skipValidation = process.env.NEXT_SKIP_ENV_VALIDATION === '1';

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default('https://mojsubkqjdruhpxbzgme.supabase.co'),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1)
    .default('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().default('https://indivisiblefairoaks.org'),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  // Optional at build time — these are only needed by runtime Stripe routes,
  // which validate them explicitly. Keeps preview builds green when the
  // Preview environment has no secrets (production-only env vars).
  STRIPE_SECRET_KEY: z.string().min(1).optional().catch(undefined),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional().catch(undefined),
  // Contact notifications: test/ops overrides (defaults are derived in-code).
  CONTACT_FUNCTION_URL: z.string().url().optional(),
  CONTACT_SUBMISSION_TEST_MODE: z.literal('1').optional(),
  NEXT_E2E_BUILD: z.literal('true').optional(),
  CONTACT_RATE_LIMIT_MAX: z.coerce.number().int().positive().optional(),
  // Resend email delivery
  RESEND_API_KEY: z.string().min(1).optional().catch(undefined),
  RESEND_FROM_EMAIL: z.string().min(1).optional().default('contact@indivisiblefairoaks.org'),
  ADMIN_ORDER_EMAIL: z.string().email().optional().catch(undefined),
});

const schema = isClient ? publicSchema : serverSchema;

type EnvValue = z.infer<typeof serverSchema>;

// Bundlers only inline dotted member accesses into the client bundle; a
// spread is opaque there, where `process.env` is an empty stub — every public
// var would arrive undefined and validation would explode at module scope
// (this bricked /cart via StripeExpressCheckout). So on the client we pick
// each public var explicitly; on the server the full env is available and a
// spread is safe.
const rawEnv: Record<string, string | undefined> = isClient
  ? {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    }
  : { ...process.env };

export const env: EnvValue = skipValidation
  ? (rawEnv as unknown as EnvValue)
  : (schema.parse(rawEnv) as EnvValue);
