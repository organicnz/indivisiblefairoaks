/**
 * Detect Next.js prerender warnings in captured build output.
 *
 * The build must fail on these lines rather than merely print them. A route
 * that reads `Date.now()` or another request-time value during prerendering
 * can still produce a successful build, with the bad read baked into the
 * output or left as a runtime failure. The guard is deliberately exact: it
 * only matches Next's two prerendering diagnostics, not arbitrary output.
 */

const ANSI_ESCAPE = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const PRERENDER_WARNING = /Next\.js encountered .*?(?:while|during) prerendering/i;

export function stripAnsi(text) {
  return text.replace(ANSI_ESCAPE, '');
}

export function findPrerenderWarnings(output) {
  const warnings = new Set();

  for (const rawLine of stripAnsi(output).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line && PRERENDER_WARNING.test(line)) {
      warnings.add(line);
    }
  }

  return [...warnings];
}
