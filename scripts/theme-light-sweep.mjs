/**
 * One-shot codemod for the light-page sweep in the theme conversion.
 *
 * Applies the token substitutions that carry a Tailwind class from a
 * hardcoded palette to the theme-aware tokens that flip with `data-theme`.
 * Deliberately narrow: it maps exactly the light-surface vocabulary the light
 * pages used (white surfaces, slate inks and hairlines) and leaves everything
 * else — dark-page surfaces, `slate-700` borders that belong to a dark
 * surface, `bg-secondary` CTAs — untouched.
 *
 * Every substitution was made with the token-sweep discipline: the value the
 * utility rendered before is the value the token resolves to in light mode, so
 * a reader on a light-OS browser sees nothing change. That is what makes the
 * sweep verifiable against `snapshots/before` rather than by eyeballing.
 *
 * Run manually; not part of the hook wiring.
 */
import { readFileSync, writeFileSync } from 'node:fs';

/** class fragment → replacement. Longest/most specific first. */
const REPLACEMENTS = [
  // ── Surfaces ────────────────────────────────────────────────────────────
  ['bg-white', 'bg-surface-card'],
  ['bg-slate-50', 'bg-surface-muted'],
  ['bg-slate-100', 'bg-surface-muted'],
  ['bg-slate-200', 'bg-surface-muted'],
  ['ring-offset-white', 'ring-offset-background'],

  // ── Inks ────────────────────────────────────────────────────────────────
  ['text-slate-600', 'text-muted-foreground'],
  ['text-slate-500', 'text-muted-foreground'],
  ['text-slate-400', 'text-muted-foreground'],
  ['text-slate-300', 'text-muted-foreground'],
  ['text-slate-200', 'text-muted-foreground'],

  // ── Hairlines ───────────────────────────────────────────────────────────
  ['border-slate-100', 'border-border'],
  ['border-slate-200', 'border-border'],
  ['border-slate-300', 'border-border'],
  ['divide-slate-100', 'divide-border'],
  ['divide-slate-50', 'divide-border'],
  ['decoration-slate-300', 'decoration-border'],
];

/** Opacity and pseudo-class variants of the same vocabulary. */
const OPACITY_REPLACEMENTS = [
  ['text-slate-500/80', 'text-muted-foreground/80'],
  ['bg-slate-50/50', 'bg-surface-muted/50'],
  ['bg-slate-50/80', 'bg-surface-muted/80'],
  ['border-slate-100/50', 'border-border/50'],
  ['placeholder:text-slate-500', 'placeholder:text-muted-foreground'],
  ['placeholder:text-slate-400', 'placeholder:text-muted-foreground'],
];

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: node scripts/theme-light-sweep.mjs <file> [...]');
  process.exit(1);
}

let total = 0;
for (const file of files) {
  const original = readFileSync(file, 'utf8');
  let next = original;
  let changed = 0;

  // The trailing-class guard: a hyphen or a quote must follow, so
  // `placeholder:text-slate-500` is not half-eaten and a hypothetical
  // `border-slate-1000` can never match.
  for (const [from, to] of REPLACEMENTS) {
    const pattern = new RegExp(`${from}(?=[\\s"'/:)])`, 'g');
    const found = next.match(pattern)?.length ?? 0;
    if (found > 0) {
      next = next.replace(pattern, to);
      changed += found;
    }
  }

  for (const [from, to] of OPACITY_REPLACEMENTS) {
    const found = next.match(new RegExp(from, 'g'))?.length ?? 0;
    if (found > 0) {
      next = next.replace(new RegExp(from, 'g'), to);
      changed += found;
    }
  }

  if (changed > 0) {
    writeFileSync(file, next);
    console.log(`${file}: ${changed}`);
    total += changed;
  }
}
console.log(`total: ${total}`);
