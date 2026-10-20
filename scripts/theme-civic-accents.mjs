/**
 * One-shot codemod for the civic pages' dark-surface accents.
 *
 * The first civic pass (`theme-civic-sweep.mjs`) carried the surfaces and the
 * body inks across. What is left are the treatments that were *written* as
 * dark-surface accents — the brand-blue eyebrow chip, gold accent text, the
 * bright-blue icon tiles — and those have no single light answer, so each one
 * gets an explicit pair here:
 *
 * - **Gold text on white is 2.15:1.** The design system's rule (AGENTS.md) is
 *   that `--accent-gold` is text-unsafe on light surfaces, so every gold label
 *   keeps its gold in dark mode and uses `--accent` in light mode. `--accent`
 *   measures 3.19:1 on white, which clears the large-text threshold these
 *   labels are sized at, and the pair is what the axe gate verifies.
 * - **`--primary-bright` / `--primary-on-dark` are the dark answers to a brand
 *   blue that is 1.5:1 against `--secondary`.** Their light counterparts are
 *   the existing light-surface tokens: `bg-primary/10` for the chip and
 *   `text-primary-ink` for the type, both of which the light pages already use.
 *
 * Ordering matters once. The general `text-white` rule runs first and the CTA
 * rule runs after it, because a CTA's white is white-on-blue in *both* modes
 * and must not become dark ink on blue: reverting those two sites by their
 * post-general form is what keeps `text-white` where it belongs.
 *
 * Every dark half is kept verbatim so a dark-mode reader sees the page exactly
 * as it was before the conversion.
 *
 * Run manually; not part of the hook wiring.
 */

/** [from, to] applied in order. */
const REPLACEMENTS = [
  // ── Headings and labels that were white-on-dark ─────────────────────────
  ['text-white', 'text-foreground dark:text-white'],

  // ── Eyebrow chip: brand blue on dark → primary ink on light ─────────────
  [
    'bg-primary-bright/10 border border-primary-on-dark-muted/30 text-primary-on-dark',
    'bg-primary/10 border border-primary/30 text-primary-ink dark:bg-primary-bright/10 dark:border-primary-on-dark-muted/30 dark:text-primary-on-dark',
  ],

  // ── Accent text and icons ───────────────────────────────────────────────
  ['text-accent-gold', 'text-accent dark:text-accent-gold'],
  ['fill-accent-gold', 'fill-accent dark:fill-accent-gold'],

  // ── Brand-blue display text and links ───────────────────────────────────
  ['text-primary-on-dark-muted', 'text-primary-ink dark:text-primary-on-dark-muted'],
  ['text-primary-on-dark', 'text-primary-ink dark:text-primary-on-dark'],

  // ── Bright-blue CTA surfaces (after the text-white rule has run) ─────────
  // White stays white: #ffffff on #1e3a8a is 10:1 and on the dark-mode
  // #155dfc is 5.3:1, so the label needs no variant at all.
  [
    'bg-primary-bright hover:bg-primary-light text-foreground dark:text-white',
    'bg-primary hover:bg-primary-dark dark:bg-primary-bright dark:hover:bg-primary-light text-white',
  ],
];

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: bun scripts/theme-civic-accents.mjs <file> [...]');
  process.exit(1);
}

let total = 0;
for (const file of files) {
  const original = await Bun.file(file).text();
  let next = original;
  let changed = 0;

  for (const [from, to] of REPLACEMENTS) {
    // `dark:`-prefixed sites are this codemod's own output from an earlier
    // pair; replacing them again would grow a second dark half.
    const pattern = new RegExp(`(?<!dark:)${from.replace(/[/.]/g, '\\$&')}`, 'g');
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
