import posthog from 'posthog-js';

/**
 * The one place this repository statically imports the PostHog SDK.
 *
 * It exists as its own module so the import can be static *and* the SDK can
 * stay out of the initial bundle. `src/lib/posthog.ts` reaches this module
 * through a dynamic `import()`, which Next.js turns into a separate chunk loaded
 * only when analytics is configured and consent allows it — so nothing here
 * ships to a visitor, a CI build or an e2e run that has no project token.
 *
 * The alternative — importing the SDK in `src/lib/posthog.ts` itself — puts
 * ~160 kB of replay recorder into the client bundle of every page, including the
 * ones where a dynamic import would never have run.
 *
 * Every configuration decision lives in `src/lib/posthog.ts`, next to the rules
 * that are unit tested. This file deliberately has none, so there is no second
 * place for the masking config to drift.
 */
export const posthogSdk = posthog;
