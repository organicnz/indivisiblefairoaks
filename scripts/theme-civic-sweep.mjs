/**
 * One-shot codemod for the civic-page sweep in the theme conversion.
 *
 * The civic pages were written once, for the dark palette, and hardcoded it:
 * `bg-secondary` surfaces, `text-white` headings, `border-white/10` hairlines.
 * The conversion gives every civic page a light variant while preserving the
 * dark variant it always had, so a reader whose OS asks for dark must see the
 * page they see today.
 *
 * That is why every mapping keeps the dark half explicit rather than folding
 * it into a token: `bg-surface-card` resolves to #1e293b in dark mode, which is
 * *not* the `bg-secondary/80` the page painted, and a snapshot diff would show
 * a page that drifted for no reason. `dark:bg-secondary/80` is the same
 * declaration it was before the change.
 *
 * The light half reuses the light-page vocabulary the rest of the site was
 * swept to (`bg-surface-card`, `border-border`, `text-foreground`,
 * `text-muted-foreground`), so a civic page in light mode is built from the
 * same tokens as /about rather than a third palette.
 *
 * Run manually; not part of the hook wiring.
 */

/**
 * Ordered [from, to] pairs. The dark half is appended verbatim, which is what
 * preserves today's dark rendering exactly.
 */
const REPLACEMENTS = [
  // ── Page and card surfaces ──────────────────────────────────────────────
  // The page root: light background, dark background only in dark mode.
  ['bg-secondary text-white', 'bg-background text-foreground dark:bg-secondary dark:text-white'],

  // Cards: an elevated card in light mode, the same translucent dark surface
  // in dark mode. The opacity variants each keep their own exact dark half.
  ['bg-secondary/80 border-white/10', 'bg-surface-card border-border shadow-card dark:bg-secondary/80 dark:border-white/10 dark:shadow-none'],
  ['bg-secondary/70 border-white/10', 'bg-surface-card border-border shadow-card dark:bg-secondary/70 dark:border-white/10 dark:shadow-none'],
  ['bg-secondary/60 border-white/10', 'bg-surface-card border-border shadow-card dark:bg-secondary/60 dark:border-white/10 dark:shadow-none'],
  ['bg-secondary/50 border-white/10', 'bg-surface-card border-border shadow-card dark:bg-secondary/50 dark:border-white/10 dark:shadow-none'],
  ['bg-secondary/40 border-white/5', 'bg-surface-muted border-border dark:bg-secondary/40 dark:border-white/5'],
  ['bg-secondary border-white/10', 'bg-surface-card border-border shadow-card dark:bg-secondary dark:border-white/10 dark:shadow-none'],

  // Inputs and chips that sit on the page background rather than a card.
  ['bg-secondary/90', 'bg-surface-card dark:bg-secondary/90'],
  ['bg-secondary/80', 'bg-surface-card dark:bg-secondary/80'],
  ['bg-secondary/60', 'bg-surface-muted dark:bg-secondary/60'],

  // ── Inks ────────────────────────────────────────────────────────────────
  ['text-ink-muted-on-dark', 'text-muted-foreground dark:text-ink-muted-on-dark'],
  ['text-ink-on-dark', 'text-muted-foreground dark:text-ink-on-dark'],
  ['text-slate-200', 'text-muted-foreground dark:text-slate-200'],
  ['text-slate-300', 'text-muted-foreground dark:text-slate-300'],
  ['text-slate-400', 'text-muted-foreground dark:text-slate-400'],
  ['placeholder-slate-400', 'placeholder:text-muted-foreground dark:placeholder:text-slate-400'],

  // ── Hairlines ───────────────────────────────────────────────────────────
  ['border-white/10', 'border-border dark:border-white/10'],
  ['border-white/5', 'border-border dark:border-white/5'],
  ['divide-white/10', 'divide-border dark:divide-white/10'],
];

/** Surface swaps that only apply inside a dark-surface block. */
const DARK_SURFACE_ONLY = [
  ['hover:bg-white/5', 'hover:bg-surface-muted dark:hover:bg-white/5'],
  ['bg-white/5', 'bg-surface-muted dark:bg-white/5'],
];

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: bun scripts/theme-civic-sweep.mjs <file> [...]');
  process.exit(1);
}

let total = 0;
for (const file of files) {
  const original = await Bun.file(file).text();
  let next = original;
  let changed = 0;

  for (const [from, to] of REPLACEMENTS) {
    const pattern = new RegExp(from.replace(/[/.]/g, '\\$&'), 'g');
    const found = next.match(pattern)?.length ?? 0;
    if (found > 0) {
      next = next.replace(pattern, to);
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
