#!/usr/bin/env bun
/**
 * Static design gate for the public civic-broadsheet surfaces and the admin
 * surface opt-in.
 *
 * Public and member-facing pages are checked for the legacy SaaS card
 * vocabulary that the redesign replaced. Account/auth pages opt into the same
 * `.civic-page` surface as public pages; admin/editor surfaces are denser by
 * design. Admin body content opts into `.admin-surface`, while the shared
 * Dialog primitive owns dialog plates and titles. This gate keeps those
 * opt-ins from silently disappearing.
 *
 * Media overlays are the one public exception. A gradient scrim over a
 * photograph is part of the image treatment, not a decorative page background,
 * so the files that own those scrims are listed explicitly rather than
 * silently exempting every gradient.
 *
 * Bun-native on purpose: this script is part of the Bun toolchain and does not
 * need a Node runtime or Node filesystem shims.
 */

const ROOT = process.cwd();
const EXCLUDED_APP_SEGMENTS = new Set(['admin', 'compose']);

const PUBLIC_COMPONENTS = [
  'src/components/layout/Header.tsx',
  'src/components/layout/Footer.tsx',
  'src/components/layout/NavDropdown.tsx',
  'src/components/layout/PageMasthead.tsx',
  'src/components/ui/Button.tsx',
  'src/components/ui/Dialog.tsx',
  'src/components/ui/MeetingMaterials.tsx',
  'src/components/ui/InteractivePostsList.tsx',
  'src/components/ui/InteractiveNewslettersList.tsx',
  'src/components/ui/CivicCommandPalette.tsx',
  'src/components/ui/WallEChatWidget.tsx',
  'src/components/ui/ActBlueDonationCalculator.tsx',
  'src/components/ui/InteractiveLinksDirectory.tsx',
  'src/components/ui/InteractiveEventsCalendar.tsx',
  'src/components/ui/SacramentoRepresentativeFinder.tsx',
  'src/components/ui/ChoirSongbookExplorer.tsx',
  'src/components/ui/ActionAlertsSubscription.tsx',
  'src/components/archive/LegacyDocumentArchive.tsx',
  'src/components/home/HomeGalleryPreview.tsx',
  'src/components/home/HeroPhotoFrame.tsx',
];

const MEDIA_OVERLAY_ALLOWLIST = new Set([
  'src/app/gallery/page.tsx',
  'src/components/home/HomeGalleryPreview.tsx',
  'src/components/home/HeroPhotoFrame.tsx',
]);

const ADMIN_LAYOUT = 'src/app/admin/layout.tsx';

async function exists(path) {
  return Bun.file(`${ROOT}/${path}`).exists();
}

function appPageSegment(path) {
  return path.split('/')[2];
}

function appPageIsRoutedSurface(path) {
  return !EXCLUDED_APP_SEGMENTS.has(appPageSegment(path));
}

async function collectPages() {
  const pages = [];
  const glob = new Bun.Glob('src/app/**/page.tsx');
  for await (const path of glob.scan({ cwd: ROOT })) {
    if (appPageIsRoutedSurface(path)) pages.push(path);
  }
  return pages;
}

async function collectTargets() {
  const pages = await collectPages();
  const additional = [];
  for (const path of ['src/app/error.tsx', ...PUBLIC_COMPONENTS]) {
    if (await exists(path)) additional.push(path);
  }
  return { pages, targets: [...pages, ...additional] };
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

const adminLayout = (await exists(ADMIN_LAYOUT))
  ? await Bun.file(`${ROOT}/${ADMIN_LAYOUT}`).text()
  : '';
if (!/\badmin-surface\b/.test(adminLayout)) {
  failures.push({
    file: ADMIN_LAYOUT,
    line: 1,
    rule: 'missing-admin-surface',
    excerpt: '',
    message: 'admin root layout must opt into .admin-surface so admin body content inherits the civic rules',
  });
}

if (failures.length > 0) {
  console.error(`\ndesign:audit failed with ${failures.length} design-pattern finding(s):\n`);
  for (const failure of failures) {
    console.error(`  ${failure.file}:${failure.line}  [${failure.rule}]`);
    console.error(`    ${failure.message}`);
    if (failure.excerpt) console.error(`    ${failure.excerpt}`);
  }
  console.error('');
  process.exit(1);
}

console.log(
  `design:audit: ${targets.length} public/member files checked; admin surface opt-in present; no banned legacy patterns.\n`
);
