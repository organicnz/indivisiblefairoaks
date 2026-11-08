#!/usr/bin/env bun
/**
 * Run `next build` and fail if Next reports a prerender warning.
 *
 * `next build` exits 0 for warnings such as:
 *
 *   Error: Route "/admin": Next.js encountered the unstable value
 *   Date.now() while prerendering.
 *
 * That is exactly how a route can ship with a broken static shell while the
 * build is green. This wrapper streams the build output unchanged, scans the
 * combined stdout/stderr, and turns those warning lines into a failed build.
 *
 * The actual build is still `bun --bun next build`; this is a guard around it,
 * not a second build implementation.
 */

import { findPrerenderWarnings } from './prerender-warnings.mjs';

const output = [];

async function forward(stream, target) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    const text = decoder.decode(value, { stream: true });
    if (text) {
      output.push(text);
      target.write(text);
    }
  }

  const tail = decoder.decode();
  if (tail) {
    output.push(tail);
    target.write(tail);
  }
}

const proc = Bun.spawn([process.execPath, '--bun', 'next', 'build'], {
  stdin: 'ignore',
  stdout: 'pipe',
  stderr: 'pipe',
});

await Promise.all([forward(proc.stdout, process.stdout), forward(proc.stderr, process.stderr)]);

const exitCode = await proc.exited;
const warnings = findPrerenderWarnings(output.join(''));

if (warnings.length > 0) {
  console.error('');
  console.error(
    `✖ Next.js emitted ${warnings.length} prerender warning${warnings.length === 1 ? '' : 's'}:`
  );
  for (const warning of warnings) {
    console.error(`  ${warning}`);
  }
  console.error('');
  console.error('A route read unstable or request-time data while prerendering.');
  console.error(
    'Fix the boundary, or declare `export const instant = false` when the route is deliberately dynamic.'
  );
  console.error('This build fails so the warning cannot ship silently.');
  process.exitCode = 1;
} else {
  process.exitCode = exitCode ?? 1;
}
