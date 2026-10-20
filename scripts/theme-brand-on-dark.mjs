/**
 * One-shot codemod: the brand-on-dark half of the theme conversion's sweep.
 *
 * The dark palette redefines `--primary` to `--primary-bright` (#155dfc) so
 * that every `bg-primary` control stays visible on a dark background — the
 * #1e3a8a it holds in light mode is 1.5:1 against `--secondary`. That swap has
 * a cost, and this codemod pays it: `text-primary` set on a surface that flips
 * to dark now measures 3.4:1, which fails AA for body text. The design
 * system's answer is `--primary-on-dark` (#8ec5ff, 6.5:1 on dark), so every
 * text usage gets the pair — the light half unchanged, the dark half the token
 * the civic pages already use for exactly this job.
 *
 * The rule is deliberately text-only. `border-primary` does not need it: a
 * border is non-text and 3.4:1 clears the 3:1 threshold the swapped blue
 * already passes. The axe gate is what proves each site, and any that
 * regresses are call sites that sit on a surface this sweep could not see.
 *
 * Run manually; not part of the hook wiring.
 */

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: bun scripts/theme-brand-on-dark.mjs <file> [...]');
  process.exit(1);
}

let total = 0;
for (const file of files) {
  const original = await Bun.file(file).text();
  let next = original;
  let changed = 0;

  // `text-primary` exactly — never one of the suffixed variants
  // (text-primary-ink / -on-dark / -bright / -light / -dark), and never a
  // site that already carries its dark half.
  const plain = /(?<!dark:)(?<![\w-])text-primary(?![\w-])/g;
  const plainFound = next.match(plain)?.length ?? 0;
  if (plainFound > 0) {
    next = next.replace(plain, 'text-primary dark:text-primary-on-dark');
    changed += plainFound;
  }

  // The hover variant of the same rule, applied after the plain rule so a
  // `hover:text-primary` is not consumed by it.
  const hover = /(?<!dark:)hover:text-primary(?![\w-])/g;
  const hoverFound = next.match(hover)?.length ?? 0;
  if (hoverFound > 0) {
    next = next.replace(hover, 'hover:text-primary dark:hover:text-primary-on-dark');
    changed += hoverFound;
  }

  if (changed > 0) {
    await Bun.write(file, next);
    console.log(`${file}: ${changed}`);
    total += changed;
  }
}
console.log(`total: ${total}`);
