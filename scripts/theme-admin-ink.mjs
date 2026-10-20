/**
 * One-shot codemod for the admin surfaces' body ink.
 *
 * `text-secondary` is the light-page body ink the admin surfaces were written
 * with, and like every light-page usage it must flip with the palette —
 * `--secondary` is the dark-surface token and deliberately does not change
 * value in dark mode.
 *
 * The exception is a *pairing*. Several badges put `text-secondary` on a
 * `bg-primary` surface, where `#0f172a` on `#1e3a8a` is 10:1 in light mode and
 * 4.6:1 on the dark-mode `#155dfc` — valid in both, so those keep the token.
 * Flipping them would paint white-on-white on the branded badges, which is the
 * failure mode this codemod exists to avoid.
 *
 * Line granularity is the test: every pairing above sits in one className on
 * one line, which this script verifies before it trusts the pattern.
 *
 * Run manually; not part of the hook wiring.
 */

/** `text-secondary` beside a brand-blue surface is a pairing, not body ink. */
const PAIRED = /bg-primary(?![a-z-])[^"'`]*text-secondary|text-secondary[^"'`]*bg-primary(?![a-z-])/;

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: bun scripts/theme-admin-ink.mjs <file> [...]');
  process.exit(1);
}

let total = 0;
let paired = 0;
for (const file of files) {
  const original = await Bun.file(file).text();
  const lines = original.split('\n');
  let changed = 0;
  let kept = 0;

  const next = lines.map((line) => {
    if (!line.includes('text-secondary')) return line;
    if (PAIRED.test(line)) {
      kept += 1;
      return line;
    }
    const count = (line.match(/text-secondary/g) ?? []).length;
    changed += count;
    return line.replaceAll('text-secondary', 'text-foreground');
  });

  if (changed > 0) {
    await Bun.write(file, next.join('\n'));
    console.log(`${file}: ${changed} flipped${kept > 0 ? `, ${kept} pairing line(s) kept` : ''}`);
    total += changed;
    paired += kept;
  }
}
console.log(`total: ${total} flipped, ${paired} pairing line(s) kept`);
