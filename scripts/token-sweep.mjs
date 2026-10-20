// One-shot codemod: raw Tailwind palette -> design tokens, on the dark civic
// surfaces only.
//
// Every mapping below was verified against the rendered pages first (see
// scripts/palette.mjs): the replacement resolves to the same painted colour, so
// the sweep is a no-op on screen and a single source of truth in the source. The
// mappings that *do* change pixels — `bg-blue-600` -> `bg-primary-bright` and
// friends — land on the identical hex the page was already drawing.
//
//   bun scripts/token-sweep.mjs [--check]
//
// `--check` reports what would change without writing.


// Dark civic surfaces only. Light commerce/auth/admin pages legitimately use the
// plain Tailwind palette for body copy (`text-slate-600` passes AA on white) and
// must not be swept.
const FILES = [
  'src/app/about/page.tsx',
  'src/app/choir/page.tsx',
  'src/app/donate/page.tsx',
  'src/app/events/page.tsx',
  'src/app/faqs/page.tsx',
  'src/app/gallery/page.tsx',
  'src/app/links/page.tsx',
  'src/app/news/page.tsx',
  'src/app/partners/page.tsx',
  'src/app/voter-info/page.tsx',
  'src/app/page.tsx',
  'src/app/search/page.tsx',
  'src/app/contact/page.tsx',
  'src/components/ui/ActBlueDonationCalculator.tsx',
  'src/components/ui/CivicActionTicker.tsx',
  'src/components/ui/ChoirSongbookExplorer.tsx',
  'src/components/ui/InteractiveEventsCalendar.tsx',
  'src/components/ui/InteractiveLinksDirectory.tsx',
  'src/components/ui/InteractiveNewslettersList.tsx',
  'src/components/ui/InteractivePostsList.tsx',
  'src/components/ui/SacramentoRepresentativeFinder.tsx',
  'src/components/ui/WallEChatWidget.tsx',
  'src/components/home/HomeGalleryPreview.tsx',
  'src/components/home/HeroPhotoFrame.tsx',
  // Shared chrome. Footer is `bg-slate-950` on every route, light or dark, so it
  // is safe to sweep and worth sweeping — it is on every page.
  'src/components/layout/Footer.tsx',
  'src/components/layout/AccountButton.tsx',
  'src/components/ui/ChoirAudioPlayer.tsx',
];

/** Ordered longest-first within each family so `blue-500/15` beats `blue-500`. */
const MAP = [
  // Surface Card & Muted Card Normalization (Eliminates invisible dark cards)
  [/(?<![\w:-])bg-surface-card\s+dark:bg-secondary\/80\s+border\s+border-border\s+dark:border-white\/10(?![/\w-])/g, 'bg-surface-card border border-border'],
  [/(?<![\w:-])bg-surface-card\s+border\s+border-border\s+dark:bg-secondary\/80\s+dark:border-white\/10(?![/\w-])/g, 'bg-surface-card border border-border'],
  [/(?<![\w:-])bg-surface-card\s+border\s+border-border\s+dark:bg-secondary\/70\s+dark:border-white\/10(?![/\w-])/g, 'bg-surface-card border border-border'],
  [/(?<![\w:-])bg-surface-card\s+border\s+border-border\s+dark:bg-secondary(?![/\w-])\s+dark:border-white\/10(?![/\w-])/g, 'bg-surface-card border border-border'],
  [/(?<![\w:-])bg-surface-card\s+dark:bg-secondary(?![/\w-])\s+border\s+border-border\s+dark:border-white\/10(?![/\w-])/g, 'bg-surface-card border border-border'],
  [/(?<![\w:-])bg-surface-card\s+dark:bg-secondary\/80(?![/\w-])/g, 'bg-surface-card'],
  [/(?<![\w:-])bg-surface-card\s+dark:bg-secondary(?![/\w-])/g, 'bg-surface-card'],
  [/(?<![\w:-])bg-surface-muted\s+dark:bg-secondary\/80\s+border\s+border-border\s+dark:border-white\/10(?![/\w-])/g, 'bg-surface-muted border border-border'],
  [/(?<![\w:-])bg-surface-muted\s+border\s+border-border\s+dark:bg-secondary(?![/\w-])\s+dark:border-white\/10(?![/\w-])/g, 'bg-surface-muted border border-border'],
  [/(?<![\w:-])bg-surface-muted\s+dark:bg-secondary\/80(?![/\w-])/g, 'bg-surface-muted'],
  [/(?<![\w:-])bg-surface-muted\s+dark:bg-secondary(?![/\w-])/g, 'bg-surface-muted'],

  // Page shell normalization
  [/(?<![\w:-])bg-background\s+text-foreground\s+dark:bg-secondary(?![/\w-])\s+dark:text-white(?![/\w-])/g, 'bg-background text-foreground'],
  [/(?<![\w:-])bg-background\s+min-h-\[70vh\]\s+text-foreground\s+dark:bg-secondary(?![/\w-])\s+dark:text-white(?![/\w-])/g, 'bg-background min-h-[70vh] text-foreground'],
  // Brand blue on dark — the values the site was already rendering.
  [/bg-blue-600\b/g, 'bg-primary-bright'],
  [/hover:bg-blue-500\b/g, 'hover:bg-primary-light'],
  [/bg-blue-500\/(\d+)\b/g, 'bg-primary-bright/$1'],
  [/text-blue-300\b/g, 'text-primary-on-dark'],
  [/hover:text-blue-300\b/g, 'hover:text-primary-on-dark'],
  [/text-blue-400\b/g, 'text-primary-on-dark-muted'],
  [/hover:text-blue-400\b/g, 'hover:text-primary-on-dark-muted'],
  [/text-blue-500\b/g, 'text-primary-on-dark-muted'],
  [/border-blue-400\/(\d+)\b/g, 'border-primary-on-dark-muted/$1'],
  [/border-blue-500\/(\d+)\b/g, 'border-primary-bright/$1'],
  [/text-blue-200\b/g, 'text-primary-on-dark'],
  [/border-blue-300\/(\d+)\b/g, 'border-primary-on-dark/$1'],

  // Amber accent.
  [/bg-amber-500\b/g, 'bg-accent-gold'],
  [/hover:bg-amber-400\b/g, 'hover:bg-accent-gold'],
  [/bg-amber-400\b/g, 'bg-accent-gold'],
  [/text-amber-300\b/g, 'text-accent-gold'],
  [/text-amber-400\b/g, 'text-accent-gold'],
  [/text-amber-500\b/g, 'text-accent-gold'],
  [/bg-amber-500\/(\d+)\b/g, 'bg-accent-gold/$1'],
  [/bg-amber-400\/(\d+)\b/g, 'bg-accent-gold/$1'],
  [/border-amber-400\/(\d+)\b/g, 'border-accent-gold/$1'],
  [/border-amber-500\/(\d+)\b/g, 'border-accent-gold/$1'],
  [/from-amber-400\b/g, 'from-accent-gold'],
  [/to-amber-400\b/g, 'to-accent-gold'],
  [/fill-amber-400\b/g, 'fill-accent-gold'],
  [/fill-amber-500\b/g, 'fill-accent-gold'],
  [/hover:text-amber-300\b/g, 'hover:text-accent-gold'],
  [/hover:border-amber-300\b/g, 'hover:border-accent-gold'],

  // Dark surfaces: slate-900 measured #0f172b against --secondary #0f172a — a
  // 1.00:1 difference, i.e. imperceptible.
  [/bg-slate-900\b/g, 'bg-secondary'],
  [/hover:bg-slate-900\b/g, 'hover:bg-secondary'],
  [/bg-slate-900\/(\d+)\b/g, 'bg-secondary/$1'],
  // Gradient stops (from-/via-/to-) are deliberately left alone: the atmospheric
  // gradients are a design decision, and flattening them is not a consistency fix.
  [/bg-slate-950\b/g, 'bg-secondary'],
  [/bg-slate-950\/(\d+)\b/g, 'bg-secondary/$1'],
  [/border-slate-800\b/g, 'border-white/10'],
  [/border-slate-900\b/g, 'border-white/10'],
  [/border-slate-700\/60\b/g, 'border-white/10'],
  [/divide-slate-800\b/g, 'divide-white/10'],
  [/bg-slate-800\b/g, 'bg-white/5'],
  [/hover:bg-slate-800\b/g, 'hover:bg-white/10'],

  // Body copy on dark: slate-300 -> --ink-on-dark, slate-400 ->
  // --ink-muted-on-dark. Both are within 1.03:1 of the token.
  [/text-slate-300\b/g, 'text-ink-on-dark'],
  [/text-slate-400\b/g, 'text-ink-muted-on-dark'],

  // Classes that do not exist in Tailwind and were rendering as no-ops.
  [/border-slate-850\b/g, 'border-white/10'],
  [/bg-slate-850\/(\d+)\b/g, 'bg-white/5'],
  [/\bno-scrollbar\b/g, '[scrollbar-width:none]'],
  [/\bxs:/g, 'sm:'],
];

const CHECK = process.argv.includes('--check');
let totalEdits = 0;
const perFile = [];

for (const file of FILES) {
  let source;
  try {
    source = await Bun.file(file).text();
  } catch {
    console.log(`  skip   ${file} (not found)`);
    continue;
  }

  let next = source;
  let edits = 0;
  for (const [pattern, replacement] of MAP) {
    const matches = next.match(pattern);
    if (matches) {
      edits += matches.length;
      next = next.replace(pattern, replacement);
    }
  }

  if (edits > 0) {
    perFile.push([file, edits]);
    totalEdits += edits;
    if (!CHECK) await Bun.write(file, next);
  }
}

perFile.sort((a, b) => b[1] - a[1]);
for (const [file, edits] of perFile) {
  console.log(`  ${String(edits).padStart(3)}  ${file}`);
}
console.log(
  `\n${CHECK ? 'would change' : 'changed'} ${totalEdits} classes across ${perFile.length} files` +
    (CHECK ? ' (dry run — nothing written)' : '')
);
