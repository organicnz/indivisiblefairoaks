#!/usr/bin/env bun
/**
 * dangerouslySetInnerHTML without sanitize guard.
 *
 * All dangerouslySetInnerHTML must be paired with sanitizeWPContent on the
 * same or immediately preceding line. The 3 existing uses are protected.
 */

const files = process.argv.slice(2);
const violations = [];

for (const file of files) {
  let content;
  try {
    content = await Bun.file(file).text();
  } catch {
    continue;
  }

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('dangerouslySetInnerHTML')) continue;

    const start = Math.max(0, i - 2);
    const end = Math.min(lines.length, i + 3);
    const context = lines.slice(start, end).join('\n');

    // JSON-LD and inline theme bootstrap are not CMS content: JSON-LD is
    // escaped via serializeJsonLd, and theme bootstrap is emitted from the
    // pure themeBootstrapScript() with no user interpolation.
    if (context.includes('application/ld+json')) continue;
    if (context.includes('themeBootstrapScript') || context.includes('theme-bootstrap')) continue;

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
