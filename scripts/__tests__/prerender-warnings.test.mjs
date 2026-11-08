// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { findPrerenderWarnings } from '../prerender-warnings.mjs';

describe('findPrerenderWarnings', () => {
  it('detects unstable and uncached-data warnings with ANSI color codes', () => {
    const output = [
      '\u001B[31mError: Route "/admin": Next.js encountered the unstable value Date.now() while prerendering.\u001B[0m',
      'Error: Route "/account/update-password": Next.js encountered uncached or runtime data during prerendering.',
    ].join('\n');

    expect(findPrerenderWarnings(output)).toEqual([
      'Error: Route "/admin": Next.js encountered the unstable value Date.now() while prerendering.',
      'Error: Route "/account/update-password": Next.js encountered uncached or runtime data during prerendering.',
    ]);
  });

  it('deduplicates repeated warnings and ignores ordinary build output', () => {
    const warning =
      'Error: Route "/admin": Next.js encountered the unstable value Date.now() while prerendering.';
    const output = [
      '✓ Compiled successfully',
      warning,
      '',
      warning,
      'Route (app)',
      '✓ Generating static pages (66/66)',
    ].join('\r\n');

    expect(findPrerenderWarnings(output)).toEqual([warning]);
  });
});
