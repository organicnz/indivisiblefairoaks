/**
 * One-shot codemod: amber labels and opaque tool panels.
 *
 * Two fixes found by the dark- and light-mode contrast audits, both in the
 * same shape — a class that was written for a dark page and inherited a light
 * surface when the page flipped.
 *
 * 1. **Amber label text.** The civic sweep paired gold text as
 *    `text-accent dark:text-accent-gold`, but the light half it picked is
 *    `--accent` (#d97706), which is 3.19:1 on white — text-unsafe at the
 *    11-12px sizes these labels are set at. The design system's sanctioned
 *    answer for light-surface eyebrow text is `--primary-ink` (7.9:1); the
 *    dark half keeps the gold it always had. Sites without a `font-` class are
 *    icons, which need only 3:1 and keep `--accent`.
 *
 * 2. **Translucent tool panels.** The calendar, calculator, songbook and
 *    representative finder are dark panels that now sit on a light page, where
 *    `bg-secondary/90` composites against white to a mid-grey that fails
 *    against its own `--ink-muted-on-dark` body copy (3.73:1). They are
 *    deliberately dark in both modes, so they become opaque instead: the
 *    composite is gone and the inks measure what they measured on the dark page.
 *
 * Run manually; not part of the hook wiring.
 */

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: bun scripts/theme-fix-audit.mjs <file> [...]');
  process.exit(1);
}

/** Amber text on a light surface → the token that is legible there. */
const AMBER_LABEL = /text-accent dark:text-accent-gold/g;

/** Translucent dark panels → opaque, so a light page cannot composite them. */
const TRANSLUCENT = [
  [/bg-secondary\/90 border border-white\/10/g, 'bg-secondary border border-white/10'],
  [/bg-secondary\/90 border/g, 'bg-secondary border'],
  [/bg-secondary\/80 border border-white\/10\/80/g, 'bg-secondary border border-white/10'],
  [/bg-secondary\/70 border border-white\/10/g, 'bg-secondary border border-white/10'],
  [/bg-secondary\/60 border border-white\/10/g, 'bg-secondary border border-white/10'],
  [/bg-secondary\/50 border border-white\/10/g, 'bg-secondary border border-white/10'],
  [/bg-secondary\/40 border border-white\/5/g, 'bg-secondary border border-white/5'],
  [/bg-secondary\/95 border border-white\/10/g, 'bg-secondary border border-white/10'],
];

let total = 0;
for (const file of files) {
  const original = await Bun.file(file).text();
  let next = original;
  let changed = 0;

  // Amber labels: one className at a time, so an icon-only site (no `font-`
  // class) keeps the amber it passes at.
  next = next.replace(/className="([^"]*)"/g, (match, classes) => {
    if (!classes.includes('text-accent dark:text-accent-gold')) return match;
    if (!/\bfont-/.test(classes)) return match;
    changed += 1;
    return `className="${classes.replace(AMBER_LABEL, 'text-primary-ink dark:text-accent-gold')}"`;
  });

  for (const [from, to] of TRANSLUCENT) {
    const found = next.match(from)?.length ?? 0;
    if (found > 0) {
      next = next.replace(from, to);
      changed += found;
    }
  }

  if (changed > 0) {
    await Bun.write(file, next);
    console.log(`${file}: ${changed}`);
    total += changed;
  }
}
console.log(`total: ${total}`);
