#!/usr/bin/env bun
/**
 * Static design gate for the public civic-broadsheet surfaces.
 *
 * This is deliberately narrow: it checks the page files and shared public
 * components that render the public site, and it bans the legacy SaaS card
 * vocabulary that the redesign replaced. Admin/account/editor surfaces are
 * denser by design and are out of scope.
 *
 * Media overlays are the one exception. A gradient scrim over a photograph is
 * part of the image treatment, not a decorative page background, so the files
 * that own those scrims are listed explicitly rather than silently exempting
 * every gradient.
 *
 * Bun-native on purpose: this script is part of the Bun toolchain and does not
 * need a Node runtime or Node filesystem shims.
 */

const ROOT = process.cwd();
const EXCLUDED_APP_SEGMENTS = new Set(['admin', 'account', 'auth', 'compose']);

const PUBLIC_COMPONENTS = [
  'src/components/layout/Header.tsx',
  'src/components/layout/Footer.tsx',
  'src/components/layout/NavDropdown.tsx',
  'src/components/layout/PageMasthead.tsx',
  'src/components/ui/Button.tsx',
  'src/components/ui/InteractiveLinksDirectory.tsx',
  'src/components/ui/InteractiveEventsCalendar.tsx',
  'src/components/ui/SacramentoRepresentativeFinder.tsx',
  'src/components/ui/ChoirSongbookExplorer.tsx',
  'src/components/ui/ActionAlertsSubscription.tsx',
  'src/components/archive/LegacyDocumentArchive.tsx',
  'src/components/home/HomeGalleryPreview.tsx',
  'src/components/home/HeroPhotoFrame.tsx',
  'src/components/ice-alerts/IceAlertDemo.tsx',
];

const MEDIA_OVERLAY_ALLOWLIST = new Set([
  'src/app/gallery/page.tsx',
  'src/components/home/HomeGalleryPreview.tsx',
  'src/components/home/HeroPhotoFrame.tsx',
]);

async function exists(path) {
  return Bun.file(`${ROOT}/${path}`).exists();
}

function appPageIsPublic(path) {
  const segment = path.split('/')[2];
  return !EXCLUDED_APP_SEGMENTS.has(segment);
}

async function collectPages() {
  const pages = [];
  const glob = new Bun.Glob('src/app/**/page.tsx');
  for await (const path of glob.scan({ cwd: ROOT })) {
    if (appPageIsPublic(path)) pages.push(path);
  }
  return pages;
}

async function collectTargets() {
  const pages = await collectPages();
  const errorSurfaces = [];
  for (const path of ['src/app/error.tsx']) {
    if (await exists(path)) errorSurfaces.push(path);
  }

  const components = [];
  for (const path of PUBLIC_COMPONENTS) {
    if (await exists(path)) components.push(path);
  }

  return { pages, targets: [...pages, ...errorSurfaces, ...components] };
}

const RULES = [
  {
    id: 'legacy-weight',
    pattern: /\bfont-black\b/g,
    message: 'legacy 900-weight type; use a Fraunces display class or font-semibold',
  },
  {
    id: 'legacy-radius',
    pattern: /\brounded-(?:2xl|3xl)\b/g,
    message: 'soft legacy radius; use a sharp plate or a rule',
  },
  {
    id: 'legacy-elevation',
    pattern: /\bshadow-(?:lg|xl|2xl)\b/g,
    message: 'decorative elevation; use a rule/border, or shadow-float for an overlay only',
  },
  {
    id: 'decorative-gradient',
    pattern: /\bbg-gradient\b/g,
    message: 'decorative gradient; use paper, muted, or ink surfaces',
  },
];

const failures = [];
const { pages: publicPages, targets } = await collectTargets();

for (const file of targets) {
  const text = await Bun.file(`${ROOT}/${file}`).text();
  const lines = text.split('\n');

  for (const rule of RULES) {
    if (rule.id === 'decorative-gradient' && MEDIA_OVERLAY_ALLOWLIST.has(file)) continue;

    for (const match of text.matchAll(rule.pattern)) {
      const index = match.index ?? 0;
      const line = text.slice(0, index).split('\n').length;
      failures.push({
        file,
        line,
        rule: rule.id,
        excerpt: lines[line - 1]?.trim().slice(0, 160) ?? '',
        message: rule.message,
      });
    }
  }

  const headingPatterns = [/<h[1-6]\b[\s\S]{0,600}?>/g, /\bas="h[1-6]"[\s\S]{0,600}?>/g];
  for (const pattern of headingPatterns) {
    for (const match of text.matchAll(pattern)) {
      if (!/\buppercase\b/.test(match[0])) continue;
      const index = match.index ?? 0;
      const line = text.slice(0, index).split('\n').length;
      failures.push({
        file,
        line,
        rule: 'uppercase-heading',
        excerpt: match[0].replace(/\s+/g, ' ').slice(0, 160),
        message: 'headings are sentence case; reserve uppercase for kickers and labels',
      });
    }
  }

  if (
    publicPages.includes(file) &&
    !/\bcivic-page\b/.test(text) &&
    !/export\s+default\s+function\s+\w*[Rr]edirect/.test(text)
  ) {
    failures.push({
      file,
      line: 1,
      rule: 'missing-civic-page',
      excerpt: '',
      message: 'public page root is missing the civic-page normalization surface',
    });
  }
}

if (failures.length > 0) {
  console.error(`\ndesign:audit failed with ${failures.length} public-pattern finding(s):\n`);
  for (const failure of failures) {
    console.error(`  ${failure.file}:${failure.line}  [${failure.rule}]`);
    console.error(`    ${failure.message}`);
    if (failure.excerpt) console.error(`    ${failure.excerpt}`);
  }
  console.error('');
  process.exit(1);
}

console.log(
  `design:audit: ${targets.length} public files checked; no banned legacy patterns.\n`
);
