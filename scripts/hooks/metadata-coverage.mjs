#!/usr/bin/env node
/**
 * New pages must be covered by metadata (page or route layout).
 *
 * Client pages ('use client') cannot export metadata — metadata is
 * server-only and silently ignored there. The codebase pattern is metadata
 * in the route's layout.tsx for client routes, page-level metadata for
 * server routes. Every route is currently covered one way or the other;
 * this guard keeps it that way for new routes.
 *
 * The AGENTS.md spec requires: "Every dynamic page MUST implement
 * generateMetadata for unique titles and descriptions."
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const files = process.argv.slice(2);
const violations = [];

const statusOutput = execSync('git diff --cached --name-status', { encoding: 'utf8' });
const added = new Set(
  statusOutput
    .split('\n')
    .filter((l) => l.startsWith('A\t'))
    .map((l) => l.slice(2))
);

for (const file of files) {
  if (!added.has(file)) continue;

  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  if (content.includes('generateMetadata') || content.includes('export const metadata')) {
    continue;
  }

  const layout = path.join(path.dirname(file), 'layout.tsx');
  if (existsSync(layout)) {
    try {
      const layoutContent = readFileSync(layout, 'utf8');
      if (
        layoutContent.includes('generateMetadata') ||
        layoutContent.includes('export const metadata')
      ) {
        continue;
      }
    } catch {
      // fall through to violation
    }
  }

  violations.push(`  ${file}`);
}

if (violations.length > 0) {
  console.log('');
  console.log('✖  New page(s) with no metadata coverage (page or route layout):');
  for (const v of violations) console.log(v);
  console.log('');
  console.log('   Server pages — export from page.tsx:');
  console.log('');
  console.log('   // Static metadata:');
  console.log('   export const metadata: Metadata = {');
  console.log('     title: \'Page Title — Indivisible Fair Oaks-Carmichael\',');
  console.log('     description: \'Description for SEO and social sharing.\',');
  console.log('   };');
  console.log('');
  console.log('   // Dynamic metadata (for pages with params):');
  console.log('   export async function generateMetadata({ params }) {');
  console.log('     return { title: `${item.name} — Indivisible Fair Oaks-Carmichael` };');
  console.log('   }');
  console.log('');
  console.log('   Client pages (\'use client\') — export from the route layout.tsx');
  console.log('   instead. A page-level export there is silently ignored.');
  console.log('');
  process.exit(1);
}
