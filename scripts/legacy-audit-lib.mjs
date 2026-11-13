/**
 * Pure helpers for the legacy Google Sites audit.
 *
 * The audit itself is deliberately read-only: this module only normalises what
 * the browser saw and what the current database contains. Keeping the rules here
 * (rather than inside the Playwright script) lets the fixture suite pin the
 * fragile parts — Drive URL shapes, filenames, chrome removal and classification
 * — without a live site, a browser or a Supabase key.
 */

export const LEGACY_BASE = 'https://sites.google.com/indivisiblefairoaks.org/indivisiblefairoaks';

/**
 * The nine public pages confirmed from the site navigation and the “More”
 * disclosure. `no-kings-4` is intentionally present: it is an empty page, and
 * recording it as empty is part of the audit rather than a reason to omit it.
 */
export const LEGACY_PAGES = [
  { path: '/', title: 'Home', destination: '/', kind: 'home' },
  {
    path: '/voter-information',
    title: 'Voter Information',
    destination: '/voter-info',
    kind: 'voter',
  },
  { path: '/upcoming-events', title: 'Upcoming Events', destination: '/events', kind: 'events' },
  {
    path: '/upcoming-events/no-kings-4',
    title: 'No Kings 4',
    destination: '/events',
    kind: 'events',
    expectedEmpty: true,
  },
  {
    path: '/upcoming-events/upcoming-fall-events',
    title: 'Upcoming Fall Events',
    destination: '/events',
    kind: 'events',
  },
  {
    path: '/current-events',
    title: 'Current Events',
    destination: '/archive#current-events',
    kind: 'current-events',
  },
  { path: '/links', title: 'Links', destination: '/links', kind: 'links' },
  {
    path: '/resistance-choir',
    title: 'Resistance Choir',
    destination: '/choir',
    kind: 'choir',
  },
  { path: '/newsletters', title: 'Newsletters', destination: '/news', kind: 'newsletters' },
];

/** Old paths whose new home is a legacy redirect rather than a live route. */
export const HISTORICAL_CONTENT_SLUGS = [
  'about-us',
  'faqs',
  'coalition-links',
  'privacy-policy',
  'terms-and-conditions',
  'shipping-returns',
  'good-trouble',
  'weekend-of-protest-song',
];

/** Drive IDs already confirmed as blocked or requiring a human export. */
export const KNOWN_BLOCKED_DRIVE_IDS = Object.freeze({
  '1Uv07FQ3td48f2bS1fouCo69L_t7UgWZG': 'Google Drive requires sign-in',
  '13CIRq153e_iCCw2pgiNwThPBQxosmy9o': 'Google Drive requires sign-in (Legal Steps source)',
  '146404h3c7E4S17UiiSHYij7Uwj_9l0LL': 'MP4 download returns a Drive confirmation page',
});

/** File names confirmed by the old page's link text, keyed by Drive ID. */
export const KNOWN_DRIVE_FILENAMES = Object.freeze({
  '10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy': 'CalMatters 2026 Voter Guide non-partisan 2026.pdf',
  '1JW2rg5dVBZBqezG3hd9QBu0znt3XsMaN': 'CA Voter Information Guide 2026.pdf',
  '11Cv8yyuI_jtNet_IFSYHDN5xFr1axfg2': 'Hands-Off-Our-Vote-2026-Toolkit.pdf',
  '1XyqCKsSKaQqrrzX7CSl3G3v0ChUtH98U': 'KEY DATES FOR THE ELECTION.docx',
  '16PoEMeUfNlrrTW7j6hwFuKJW0aDuHfTi': 'EVG-Nov26-Sp.pdf',
  '146404h3c7E4S17UiiSHYij7Uwj_9l0LL': 'Resilience_Trim.mp4',
});

const THIRD_PARTY_HOSTS = [
  'calmatters.org',
  'lwv.org',
  'leagueofwomenvoters.org',
  'aclu.org',
  'aclu-nc.org',
  'sos.ca.gov',
  'saccounty.gov',
  'brennancenter.org',
  'indivisible.org',
  'indivisibleca.org',
];

const THIRD_PARTY_FILENAME_HINTS = [
  'calmatters',
  'league of women voters',
  'league',
  'aclu',
  'hands-off',
  'no-on-prop',
  'voter information guide',
  'legal-steps',
  'general overview of your rights',
];

const CHROME_LINES = [
  /^search this site$/i,
  /^embedded files$/i,
  /^skip to main content$/i,
  /^skip to navigation$/i,
  /^report abuse$/i,
  /^page details$/i,
  /^page updated$/i,
  /^more$/i,
  /^home$/i,
  /^donate$/i,
  /^donate to our chapter$/i,
  /^donate to indivisible(?:\s*→)?$/i,
  /^donate to indivisible fair oaks\/carmichael$/i,
  /^subscribe to our mailing list at .*$/i,
  /^·\s*indivisible$/i,
  /^fair oaks-carmichael$/i,
  /^← visit us on instagram$/i,
  /^get in touch with our chapter at$/i,
  /^contact@indivisiblefairoaks\.org$/i,
  /^indivisiblefairoaks\.org$/i,
  /^last edited by .*$/i,
];

/**
 * Google Sites wraps external links in a google.com/url redirect. The wrapper
 * hides the real host from classification and makes the same link look
 * different on every page, so resolve it before doing anything else.
 */
export function unwrapGoogleRedirect(value) {
  if (!value || typeof value !== 'string') return '';
  try {
    const url = new URL(value, LEGACY_BASE);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'google.com' || url.pathname !== '/url') return value;
    const target = url.searchParams.get('q') ?? url.searchParams.get('url');
    return target ? target.trim() : value;
  } catch {
    return value;
  }
}

/** Remove fragment and tracking parameters while keeping a stable URL identity. */
export function normalizeUrl(value, base = LEGACY_BASE) {
  if (!value || typeof value !== 'string') return '';
  try {
    const url = new URL(unwrapGoogleRedirect(value), base);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|ts$|usp$|rtpof$|sd$|gclid$|fbclid$|sa$|sntz$|usg$)/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return value.trim();
  }
}

const LEGACY_HOST = 'sites.google.com';
const LEGACY_PATH = '/indivisiblefairoaks.org/indivisiblefairoaks';
const CHROME_LINK_HREFS = new Set(['mailto:contact@indivisiblefairoaks.org']);

/** True for a link back into the old site, which is navigation rather than content. */
export function isLegacySelfLink(value) {
  try {
    const url = new URL(normalizeUrl(value));
    return (
      url.hostname.toLowerCase() === LEGACY_HOST &&
      url.pathname.startsWith(LEGACY_PATH)
    );
  } catch {
    return false;
  }
}

/** Prefer a title over a scraped Mobilize description joined to it. */
export function cleanLinkLabel(value, href = '') {
  let label = normalizeText(value).replace(/\s+/g, ' ').trim();
  if (!label) {
    try {
      label = new URL(href).hostname.replace(/^www\./, '');
    } catch {
      label = href;
    }
  }
  // Links copied from Google Sites often read "Event title · HostThe full
  // description...". Keep the title segment when it is substantial.
  const title = label.split(/\s+·\s+/)[0].trim();
  if (title.length >= 8 && title.length < label.length) label = title;
  if (label.length > 160) label = `${label.slice(0, 157).trimEnd()}…`;
  return label;
}

function linkLabelScore(label, href) {
  let score = 0;
  if (label && !/^https?:\/\//i.test(label)) score += 10;
  if (label.length <= 120) score += 4;
  if (!/…$/.test(label)) score += 1;
  score -= Math.min(label.length / 100, 5);
  if (href.startsWith('mailto:')) score += 2;
  return score;
}

/**
 * Drop the old site's navigation, repeated contact footer and duplicate
 * wrapped links. The archive should show the five or six real destinations on
 * a page, not seventy copies of the same Google Sites chrome.
 */
export function cleanPageLinks(links, pageUrl = LEGACY_BASE) {
  const chosen = new Map();
  for (const link of links ?? []) {
    const href = normalizeUrl(link.href);
    if (!href || href.startsWith('#') || CHROME_LINK_HREFS.has(href)) continue;
    if (isLegacySelfLink(href)) continue;
    const label = cleanLinkLabel(link.text ?? link.label ?? '', href);
    const candidate = {
      href,
      text: label,
      external: (() => {
        try {
          return new URL(href).origin !== new URL(pageUrl).origin;
        } catch {
          return false;
        }
      })(),
    };
    const existing = chosen.get(href);
    if (!existing || linkLabelScore(candidate.text, href) > linkLabelScore(existing.text, href)) {
      chosen.set(href, candidate);
    }
  }
  return [...chosen.values()];
}

/** Collapse whitespace without changing sentence content. */
export function normalizeText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Google Sites leaves a literal navigation/footer run around the main content.
 * This removes the known furniture and repeated nav labels, then keeps the
 * remaining text. It is intentionally conservative: a line is only removed when
 * it matches a known chrome line, never because it merely looks short.
 */
export function stripLegacyChrome(value) {
  const text = normalizeText(value);
  if (!text) return '';

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !CHROME_LINES.some((pattern) => pattern.test(line)));

  // The main region repeats the page title and nav labels. Collapse exact
  // consecutive duplicates but leave the first occurrence in place.
  const deduped = [];
  for (const line of lines) {
    if (deduped[deduped.length - 1] !== line) deduped.push(line);
  }
  return deduped.join('\n');
}

/** Extract a Google Drive/Docs file ID from the URL shapes Google Sites emits. */
export function driveIdFromUrl(value) {
  if (!value) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (
    !host.endsWith('drive.google.com') &&
    !host.endsWith('docs.google.com') &&
    !host.endsWith('docs.googleusercontent.com')
  ) {
    return null;
  }

  const path = url.pathname;
  const fileMatch = path.match(/\/(?:file|document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]{20,})/);
  if (fileMatch) return fileMatch[1];
  const id = url.searchParams.get('id');
  if (id && /^[a-zA-Z0-9_-]{20,}$/.test(id)) return id;
  return null;
}

/** True when the URL points at a Google Doc rather than an uploaded Drive file. */
export function isGoogleDocUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return /(^|\.)docs\.google\.com$/i.test(url.hostname) && /\/document\/d\//.test(url.pathname);
  } catch {
    return false;
  }
}

/** Download URL for a Drive file; Google Docs get a PDF export URL instead. */
export function driveDownloadUrl(value) {
  const id = driveIdFromUrl(value);
  if (!id) return value;
  if (isGoogleDocUrl(value)) {
    return `https://docs.google.com/document/d/${id}/export?format=pdf`;
  }
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

/** Extract a YouTube video ID from watch, embed, shorts and youtu.be URLs. */
export function youtubeIdFromUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{6,}$/.test(id) ? id : null;
    }
    if (!['youtube.com', 'youtube-nocookie.com'].includes(host)) return null;
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v');
      return id && /^[a-zA-Z0-9_-]{6,}$/.test(id) ? id : null;
    }
    const match = url.pathname.match(/^\/(?:embed|shorts|v)\/([a-zA-Z0-9_-]{6,})/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Parse a filename out of Content-Disposition, including RFC 5987 forms. */
export function filenameFromDisposition(header) {
  if (!header) return null;
  const encoded = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded).replace(/^["']|["']$/g, '');
    } catch {
      return encoded.replace(/^["']|["']$/g, '');
    }
  }
  const quoted = header.match(/filename\s*=\s*"([^"]+)"/i)?.[1];
  if (quoted) return quoted;
  return header.match(/filename\s*=\s*([^;]+)/i)?.[1]?.trim() ?? null;
}

/** Last path segment, decoded, or null when the URL has no useful name. */
export function filenameFromUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const name = url.pathname.split('/').filter(Boolean).at(-1);
    if (!name) return null;
    const decoded = decodeURIComponent(name);
    return /\.[a-z0-9]{2,8}$/i.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

/** The extension-based kind used when the page does not tell us the MIME type. */
export function kindFromFilename(filename) {
  const ext = String(filename ?? '')
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/)?.[1];
  if (!ext) return null;
  if (ext === 'pdf') return 'pdf';
  if (ext === 'doc' || ext === 'docx') return 'document';
  if (ext === 'mp4' || ext === 'mov' || ext === 'webm') return 'video';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext)) return 'image';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'spreadsheet';
  return null;
}

/** Classify a URL as a document, Drive file, YouTube video, image or link. */
export function classifyUrl(value, label = '') {
  const id = driveIdFromUrl(value);
  const youtubeId = youtubeIdFromUrl(value);
  if (youtubeId) return { kind: 'youtube', driveId: null, youtubeId };
  if (id) {
    return {
      kind: isGoogleDocUrl(value) ? 'google-doc' : 'drive',
      driveId: id,
      youtubeId: null,
    };
  }
  // Google Sites rewrites inline images to a site-relative image proxy with no
  // extension; they are still content images, not links.
  try {
    const url = new URL(value);
    if (/(^|\.)googleusercontent\.com$/i.test(url.hostname) || /\/sitesv-images-rt\//i.test(url.pathname)) {
      return { kind: 'image', driveId: null, youtubeId: null };
    }
  } catch {
    // Fall through to the extension-based classification.
  }
  const filename = filenameFromUrl(value) ?? (label.match(/\.(pdf|docx?|mp4|mov|webm)$/i) ? label : null);
  const extKind = kindFromFilename(filename);
  return {
    kind: extKind ?? 'link',
    driveId: null,
    youtubeId: null,
    filename: filename ?? null,
  };
}

/** Infer rights conservatively. Unknown is a valid answer, not a default to publish. */
export function classifyRights(value, filename = '') {
  const haystack = `${value ?? ''} ${filename ?? ''}`.toLowerCase();
  let host = '';
  try {
    host = new URL(value).hostname.toLowerCase();
  } catch {
    // A Drive URL has no useful publishing signal; fall through to the filename.
  }
  if (THIRD_PARTY_HOSTS.some((known) => host === known || host.endsWith(`.${known}`))) {
    return 'third_party';
  }
  if (THIRD_PARTY_FILENAME_HINTS.some((hint) => haystack.includes(hint))) {
    return 'third_party';
  }
  if (/(indivisible|resistance|choir|newsletter|pre-register|homeless is not voteless)/i.test(haystack)) {
    return 'chapter_owned';
  }
  return 'unknown';
}

/** Normalise a dedupe key so the same Drive file found in two shapes collapses. */
export function assetKey(asset) {
  if (asset.driveId) return `drive:${asset.driveId}:${asset.kind}`;
  if (asset.youtubeId) return `youtube:${asset.youtubeId}`;
  return `url:${normalizeUrl(asset.sourceUrl)}`;
}

/** Merge duplicate assets while retaining every page that referenced them. */
export function dedupeAssets(assets) {
  const map = new Map();
  for (const asset of assets) {
    const key = assetKey(asset);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...asset, key, pagePaths: [...new Set(asset.pagePaths ?? [])] });
      continue;
    }
    existing.pagePaths = [...new Set([...(existing.pagePaths ?? []), ...(asset.pagePaths ?? [])])];
    existing.filename ||= asset.filename;
    existing.driveId ||= asset.driveId;
    existing.youtubeId ||= asset.youtubeId;
    existing.altText ||= asset.altText;
    existing.caption ||= asset.caption;
    existing.mimeType ||= asset.mimeType;
    existing.byteSize ||= asset.byteSize;
    existing.localFile ||= asset.localFile;
    existing.blockedReason ||= asset.blockedReason;
    existing.rights = existing.rights === 'unknown' ? asset.rights : existing.rights;
  }
  return [...map.values()];
}

/** Build the download URL for a page asset, preserving direct file URLs. */
export function downloadUrlFor(asset) {
  if (asset.driveId) return driveDownloadUrl(asset.sourceUrl);
  return asset.sourceUrl;
}

/** A stable, human-readable filename for this asset in the manifest. */
export function displayFilename(asset) {
  return (
    asset.filename ||
    KNOWN_DRIVE_FILENAMES[asset.driveId] ||
    filenameFromUrl(asset.sourceUrl) ||
    (asset.youtubeId ? `youtube-${asset.youtubeId}` : 'untitled')
  );
}

/** Known blocked IDs plus a source-specific fallback. */
export function blockedReasonFor(asset) {
  if (asset.blockedReason) return asset.blockedReason;
  if (asset.driveId && KNOWN_BLOCKED_DRIVE_IDS[asset.driveId]) {
    return KNOWN_BLOCKED_DRIVE_IDS[asset.driveId];
  }
  return null;
}

/** The path portion of a normalized URL, used to match current site routes. */
export function pathFromUrl(value) {
  try {
    return new URL(value).pathname.replace(/\/+$/, '') || '/';
  } catch {
    return value?.startsWith('/') ? value.replace(/\/+$/, '') || '/' : '';
  }
}

/** Classify an old page against the destinations and routes in the current app. */
export function classifyPageStatus(page, { routes = [], legacyRedirects = [] } = {}) {
  const destination = page.destination ?? '';
  const destinationPath = destination.split('#')[0] || '/';
  if (destinationPath === '/archive') {
    return routes.includes('/archive') ? 'archive' : 'archive_missing';
  }
  if (routes.includes(destinationPath) || legacyRedirects.includes(destinationPath)) {
    return 'represented';
  }
  if (page.expectedEmpty) return 'empty';
  return 'missing';
}

/** True when a page has essentially no article body, independent of nav chrome. */
export function isEmptyLegacyPage(page) {
  const text = stripLegacyChrome(page.text ?? '');
  const words = text ? text.split(/\s+/).filter(Boolean) : [];
  return words.length < 20 && (page.assets?.length ?? 0) === 0;
}

/** A filename safe for the private archive bucket, while keeping the original stem. */
export function safeArchiveFilename(filename, fallback = 'legacy-asset') {
  const base = String(filename || fallback)
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s-]+/, '')
    .slice(0, 160);
  return base || fallback;
}

/** Human-readable byte count for the report. */
export function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return 'unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
