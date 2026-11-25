// @vitest-environment node
import { describe, expect, it } from 'vitest';

/**
 * The Edge Functions that accept a request body must use
 * `_shared/request-body.ts`, never `request.json()` / `.text()` / `.formData()`.
 *
 * A previous pass converted every function except `search`, which is deployed
 * with JWT verification off and is therefore reachable by anyone. It still
 * called `c.req.json()`, which buffers the entire body before any size check
 * can run. That is exactly the failure the shared reader exists to prevent, and
 * it is invisible to a type check because both APIs have the same type.
 *
 * This is a static contract, not a substitute for behaviour tests: it catches
 * the one regression that matters here — a new handler reaching for the
 * framework parser because it is the shortest thing to write.
 */

const ROOT = process.cwd();

/** Functions that intentionally read a request body. */
const BODY_READERS = [
  'crm-broadcast-send',
  'ice-case-brief',
  'ice-discovery-triage',
  'ice-source-refine',
  'notify-contact',
  'search',
  'sync-mobilize-events',
  'wall-e-chat',
] as const;

const UNBOUNDED_READ = /(?:c\.req|request|req)\.(?:json|text|formData)\s*\(/;

/** The source comments deliberately quote the old calls; they are not code. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Edge Function request-body limits', () => {
  it('uses the shared bounded reader instead of unbounded body parsing', async () => {
    const offenders: string[] = [];
    const missingReader: string[] = [];

    for (const slug of BODY_READERS) {
      const source = await Bun.file(`${ROOT}/supabase/functions/${slug}/index.ts`).text();

      if (UNBOUNDED_READ.test(withoutComments(source))) offenders.push(slug);
      if (!source.includes('_shared/request-body')) missingReader.push(slug);
    }

    expect(offenders).toEqual([]);
    expect(missingReader).toEqual([]);
  });
});
