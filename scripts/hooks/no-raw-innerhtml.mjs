#!/usr/bin/env node
/**
 * dangerouslySetInnerHTML without sanitize guard.
 *
 * All dangerouslySetInnerHTML must be paired with sanitizeWPContent on the
 * same or immediately preceding line. The 3 existing uses are protected.
 */
import { readFileSync } from 'node:fs';

const files = process.argv.slice(2);
const violations = [];

for (const file of files) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('dangerouslySetInnerHTML')) continue;

    const start = Math.max(0, i - 2);
    const end = Math.min(lines.length, i + 3);
    const context = lines.slice(start, end).join('\n');

    // JSON-LD is not CMS content: it is a structure we build and escape
    // ourselves via serializeJsonLd, so it must not be wrapped in
    // sanitizeWPContent (which would mangle the markup). Allow it only
    // when the same block declares the ld+json script type — so a CMS
    // body injected into a real <div> is still caught.
    if (context.includes('application/ld+json')) continue;

    if (!context.includes('sanitizeWPContent')) {
      violations.push(`  ${file}:${i + 1}`);
    }
  }
}

if (violations.length > 0) {
  console.log('');
  console.log('✖  dangerouslySetInnerHTML without sanitizeWPContent:');
  for (const v of violations) console.log(v);
  console.log('');
  console.log('   Wrap with: sanitizeWPContent(yourContent)');
  console.log('   (JSON-LD <script type="application/ld+json"> is exempt — it is');
  console.log('    escaped by serializeJsonLd, not CMS content.)');
  console.log('');
  process.exit(1);
}
