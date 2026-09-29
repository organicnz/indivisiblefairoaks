/**
 * Shared sanitization utilities for WordPress-migrated and user-generated content.
 * All functions are fail-safe: they never throw and return '' on error.
 */
import sanitizeHtml, { type IOptions } from 'sanitize-html';
import { getStorageUrl } from './supabase';

export const SPAM_KEYWORDS = [
  'casino',
  'slot',
  'betting',
  'gambling',
  'poker',
  'bingo',
  'bonus',
  'rtp',
  'vavada',
  '1xbet',
  'mostbet',
  'pin-up',
  'vulcan',
  'mahjong',
  'sweet bonanza',
  'judi',
  'genset',
  'daftar',
  'situs',
  'gacor',
  'olympus',
  'sbobet',
  'spaceman',
  'pragmatic',
  'xanax',
  'steroid',
  'kasyno',
  'betsala',
  'jeetcity',
  'wazamba',
  'moonwin',
  'winspirit',
  'loto',
  'apuesta',
  'hellspincassino',
  'candyspinz',
  'wildsino',
  'f12bet',
  'mangsatoto',
  '1winrussia',
  'φρουτακια',
  'лото клуб',
  'vavada.az',
  'stake casino',
  'jeet city',
  '1xbet uz',
  'apuesta-360',
] as const;

export const TRUSTED_DOMAINS = [
  'indivisiblefairoaks.org',
  'i0.wp.com',
  'i1.wp.com',
  'i2.wp.com',
  'supabase.co',
  'stripe.com',
  'mobilize.us',
  'actblue.com',
  'indivisible.org',
  'indivisibleca.org',
  // Sea Cleaners mission partner (donation links live in CharitySection and CMS content).
  'seacleaners.org.nz',
  'givealittle.co.nz',
] as const;

/**
 * Class/id fragments identifying Google Sites page furniture. The CMS was
 * imported from a Google Site whose navigation was baked into every page body, so
 * each migrated page repeats "Search this site", "Skip to main content" and the
 * full sidebar nav several times over. Left in place it corrupts the page copy and,
 * worse, the meta description — which is derived from the first 150 characters of
 * the body, so SERP snippets began "IndivisibleFairOaks.org - Links Search this
 * site Embedded Files Skip to main content…".
 */
const GOOGLE_SITES_CHROME = [
  'gs-',
  'gc-',
  'sites-',
  'googlesites',
  'skip to main',
  'skip to navigation',
  'embedded files',
  'search this site',
  'page-links',
  'globalnav',
  'globalfooter',
] as const;

/** Boilerplate phrases that survive as bare text once the wrappers are removed. */
const GOOGLE_SITES_PHRASES = [
  /\bSearch this site\b/gi,
  /\bSkip to main content\b/gi,
  /\bSkip to navigation\b/gi,
  /\bEmbedded Files\b/gi,
] as const;

/**
 * Whole-line chrome from the Google Sites text export.
 *
 * The CMS bodies are not HTML at all — the export stripped every tag and left
 * newline-separated text, so the page furniture is a run of literal lines at the
 * top ("Search this site", "Skip to main content", …) and another at the bottom
 * ("Report abuse", "Page details", "Page updated"). Tag-based stripping cannot
 * see any of it.
 */
const GOOGLE_SITES_CHROME_LINES: readonly RegExp[] = [
  /^search this site$/i,
  /^embedded files$/i,
  /^skip to main content$/i,
  /^skip to navigation$/i,
  /^report abuse$/i,
  /^page details$/i,
  /^page updated$/i,
  /^more$/i,
  /^indivisiblefairoaks\.org$/i,
  /^indivisiblefairoaks\.org\s*[-–—]\s*/i,
  /^indivisible fair Oaks/i,
  /^last edited by .*$/i,
] as const;

/**
 * Detects the Google Sites text-export format. Every cleanup below is gated on
 * this so it can never touch hand-authored or WordPress content.
 */
function looksLikeGoogleSitesExport(text: string): boolean {
  return /search this site/i.test(text) && /(skip to main content|embedded files)/i.test(text);
}

/**
 * Collapses a block of consecutive lines that is repeated verbatim.
 *
 * The exported pages carry the same sidebar navigation three or four times —
 * once per Google Sites layout region — which is why shipped meta descriptions
 * began "IndivisibleFairOaks.org - Links Search this site Embedded Files Skip to
 * main content…". Removing the duplicate copies keeps the first, which is the
 * one adjacent to real content.
 *
 * Scans longest block first so the maximal repeated run is collapsed in one
 * pass. Only blocks of three or more lines are considered: shorter repeats are
 * far more likely to be ordinary prose that happens to coincide.
 */
function collapseRepeatedBlocks(lines: string[], minBlockSize = 3): string[] {
  let working = lines;
  let removedSomething = true;

  while (removedSomething) {
    removedSomething = false;

    search: for (let size = working.length; size >= minBlockSize; size--) {
      for (let start = 0; start + size <= working.length; start++) {
        const block = working.slice(start, start + size);
        const key = block.join('\n');
        // Only collapse a block that repeats later in the document, and never
        // more than once per pass so overlapping copies cannot loop.
        for (let other = start + size; other + size <= working.length; other++) {
          const candidate = working.slice(other, other + size);
          if (candidate.join('\n') === key) {
            working = [...working.slice(0, other), ...working.slice(other + size)];
            removedSomething = true;
            break search;
          }
        }
      }
    }
  }

  return working;
}

/**
 * A line shaped like a Google Sites navigation label: title-cased, short, and
 * without sentence punctuation. Used only to find the end of a leading nav run.
 */
const NAV_LABEL_SHAPE = /^[\p{Lu}][\p{L}\p{N}&'’\- ]{0,40}$/u;

/**
 * Strips the leading sidebar-navigation run from an exported body.
 *
 * After the duplicate copies are collapsed, one copy survives at the top. The
 * export always puts it first (the "Home" logo link) and always lists the
 * current page among its own items — so the real page heading is the first line
 * that *repeats* something already in the run. That gives a general stop
 * condition with no hardcoded navigation vocabulary.
 *
 * Falls back to the label shape when nothing repeats, so a page whose title is
 * not itself a nav item still gets its chrome removed.
 */
function stripLeadingNavRun(lines: string[]): string[] {
  if (lines.length === 0 || lines[0].trim().toLowerCase() !== 'home') return lines;

  const seen = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const key = lines[i].trim().toLowerCase();
    if (seen.has(key)) return lines.slice(i);
    seen.add(key);
    if (!NAV_LABEL_SHAPE.test(lines[i].trim())) return lines.slice(i);
  }

  // Every line looked like a label and nothing repeated — the whole document is
  // navigation, so there is no content left to keep.
  return [];
}

/**
 * Removes Google Sites page furniture from an exported plain-text body.
 * Returns the input unchanged for anything that is not an export.
 */
export function stripMigratedSiteChrome(text: string): string {
  if (!looksLikeGoogleSitesExport(text)) return text;

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !GOOGLE_SITES_CHROME_LINES.some((pattern) => pattern.test(line)));

  return stripLeadingNavRun(collapseRepeatedBlocks(lines)).join('\n');
}

const HTML_SANITIZE_OPTIONS: IOptions = {
  allowedTags: [
    'a',
    'abbr',
    'b',
    'blockquote',
    'br',
    'code',
    'del',
    'div',
    'em',
    'figcaption',
    'figure',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'i',
    'img',
    'li',
    'ol',
    'p',
    'pre',
    's',
    'span',
    'strong',
    'sub',
    'sup',
    'table',
    'tbody',
    'td',
    'th',
    'thead',
    'tr',
    'u',
    'ul',
  ],
  allowedAttributes: {
    '*': ['class', 'id', 'title', 'aria-label', 'aria-describedby', 'role'],
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'loading'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  // `discard` strips the tag but keeps its children, which is right for inline
  // markup and catastrophic for page furniture: the CMS was migrated from Google
  // Sites, whose entire navigation chrome was copied into each page's body. Listing
  // the container tags here makes sanitize-html drop the whole subtree instead.
  // Only ever applied to CMS `content.body` strings — never to our own layout.
  nonTextTags: ['script', 'style', 'textarea', 'option', 'nav', 'aside', 'header', 'footer'],
  // Google Sites wraps its chrome in class/id markers that survive the class-name
  // filter. Drop the whole element rather than leaking "Search this site" and
  // "Skip to main content" into page copy and meta descriptions.
  exclusiveFilter: (frame) => {
    const marker = `${frame.attribs?.class ?? ''} ${frame.attribs?.id ?? ''}`.toLowerCase();
    return (
      frame.tag === 'nav' ||
      frame.tag === 'aside' ||
      GOOGLE_SITES_CHROME.some((needle) => marker.includes(needle))
    );
  },
  transformTags: {
    a: (_tagName, attribs) => ({
      tagName: 'a',
      attribs: attribs.target === '_blank' ? { ...attribs, rel: 'noopener noreferrer' } : attribs,
    }),
  },
};

/**
 * Utility to check if a given string contains spam keywords or non-latin characters.
 * Used for aggressively filtering out malicious injections or spam pages.
 */
export function isSpamContent(text: string): boolean {
  if (!text) return false;
  const lowerText = text.toLowerCase();

  // Check for spam keywords
  const hasSpamKeyword = SPAM_KEYWORDS.some((kw) => lowerText.includes(kw));

  // Check for non-ASCII characters (spam payloads often use homoglyph alphabets).
  // \p{ASCII} covers U+0000–U+007F, identical to the old [^\x00-\x7F] range
  // but written without control escapes so linters stay quiet.
  const hasNonLatin = /[^\p{ASCII}]/u.test(text) && !lowerText.includes('indivisible');

  return hasSpamKeyword || hasNonLatin;
}

const INVALID_URL_ENTITY = '__invalid_url_entity__';

function decodeUrlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    colon: ':',
    gt: '>',
    lt: '<',
    quot: '"',
  };

  return value.replace(
    /&#(x[0-9a-f]+|[0-9]+);?|&(amp|apos|colon|gt|lt|quot);/gi,
    (match, numeric: string | undefined, named: string | undefined) => {
      if (numeric) {
        const code = numeric.toLowerCase().startsWith('x')
          ? Number.parseInt(numeric.slice(1), 16)
          : Number.parseInt(numeric, 10);
        return Number.isInteger(code) && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : INVALID_URL_ENTITY;
      }
      return named ? namedEntities[named.toLowerCase() as keyof typeof namedEntities] : match;
    }
  );
}

function normalizeUrlForSafety(value: string): string {
  return [...value]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 0x20 && code !== 0x7f;
    })
    .join('');
}

/**
 * Removes WordPress artifacts, spam content, and XSS vectors from HTML strings.
 * Safe to call on any user-generated or legacy-migrated content.
 *
 * Hardened: handles quoted AND unquoted attributes, style vectors,
 * active-content elements (svg/math/video/etc), protocol-relative links,
 * and subdomain-aware trusted-domain checks.
 */
export function sanitizeWPContent(html: string): string {
  if (!html) return '';

  try {
    let clean = html;

    // 0. Google Sites page furniture. The migrated bodies are plain text rather
    // than HTML, so the site chrome is a run of literal lines, not elements.
    // This has to run first: every pass below should only ever see real content.
    clean = stripMigratedSiteChrome(clean);

    // 0.5. Strip active-content elements WITH their bodies. Callers inject
    // this output as raw HTML, so script/style/iframe/plugin content must go.
    clean = clean.replace(/<script[\s\S]*?<\/script\s*>/gi, '');
    clean = clean.replace(/<style[\s\S]*?<\/style\s*>/gi, '');
    clean = clean.replace(/<iframe[\s\S]*?<\/iframe\s*>/gi, '');
    clean = clean.replace(
      /<\/?(?:script|iframe|object|embed|applet|frame|frameset|form|input|select|textarea|button|link|meta|base|svg|math|style|video|audio|source|track|marquee|blink|body|html|canvas)\b[^>]*>/gi,
      ''
    );
    // Strip lone opening tags that survived without a close (e.g. <svg onload=...>)
    clean = clean.replace(/<(?:svg|math|iframe|object|embed|script|style|video|audio)[^>]*$/gi, '');
    // Neutralize script-scheme URLs in href/src/xlink:href — quoted, single-quoted AND unquoted.
    clean = clean.replace(
      /(\s(?:href|src|xlink:href)\s*=\s*)(?:"\s*(?:javascript|data|vbscript)[^"]*"|'\s*(?:javascript|data|vbscript)[^']*'|[^\s>]*?(?:javascript|data|vbscript):[^\s>]*)/gi,
      '$1"#"'
    );

    // 0.5. Remove Google Sites page furniture before anything else, so no later
    // pass (or the meta-description extractor) can read navigation text as body
    // copy. Container tags are dropped whole rather than unwrapped.
    for (const tag of ['nav', 'aside', 'header', 'footer'] as const) {
      clean = clean.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '');
      // Unclosed variants (a truncated migration left some behind).
      clean = clean.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*$`, 'i'), '');
    }
    for (const phrase of GOOGLE_SITES_PHRASES) {
      clean = clean.replace(phrase, '');
    }
    // Div wrappers carrying a Google Sites marker: drop the element and its
    // contents. Non-greedy, so an inner `</div>` terminates the match early and
    // leaves any real content that followed intact.
    for (const needle of GOOGLE_SITES_CHROME) {
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      clean = clean.replace(
        new RegExp(
          `<div\\b[^>]*(?:class|id)\\s*=\\s*"[^"]*${escaped}[^"]*"[^>]*>[\\s\\S]*?<\\/div\\s*>`,
          'gi'
        ),
        ''
      );
    }

    // 1. Remove Gutenberg block comments: <!-- wp:... --> and <!-- /wp:... -->
    clean = clean.replace(/<!--\s*\/?wp:[\s\S]*?-->/g, '');

    // 2. Replace [wpforms...] shortcodes with a styled contact div
    clean = clean.replace(
      /\[wpforms[^\]]*\]/gi,
      '<div class="p-4 bg-slate-50 border border-slate-100 rounded-2xl my-8 text-secondary font-bold uppercase tracking-widest text-xs text-center">Please use our official <a href="/contact" class="text-primary underline">Contact Page</a> to reach out.</div>'
    );

    // 3. Remove untrusted external links. Relative (/contact, #anchor),
    // mailto:/tel: and trusted-domain (incl. subdomains) links are kept.
    // Everything else (incl. unquoted, protocol-relative //evil, ftp:) is dropped.
    clean = clean.replace(/<a\s[^>]*?>[\s\S]*?<\/a\s*>/gi, (match) => {
      const hrefMatch = match.match(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      if (!hrefMatch) return match;
      const rawHref = (hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3] ?? '').trim();
      if (!rawHref) return '';
      const decodedHref = decodeUrlEntities(rawHref);
      if (decodedHref.includes(INVALID_URL_ENTITY)) return '';
      const normalizedHref = normalizeUrlForSafety(decodedHref);
      if (normalizedHref.includes('\\')) return '';
      const lower = normalizedHref.toLowerCase();
      // Protocol-relative //evil.com must NOT be treated as a relative path.
      if (lower.startsWith('//')) {
        const hostMatchProto = lower.match(/^\/\/([^/:?#\s]+)/);
        const hostProto = hostMatchProto?.[1] ?? '';
        const trustedProto = TRUSTED_DOMAINS.some(
          (d) => hostProto === d || hostProto.endsWith(`.${d}`)
        );
        return trustedProto ? match.replace(rawHref, `https:${rawHref}`) : '';
      }
      if (
        lower.startsWith('/') ||
        lower.startsWith('#') ||
        lower.startsWith('mailto:') ||
        lower.startsWith('tel:')
      ) {
        return match;
      }
      // Protocol-relative or absolute URL — extract host.
      const hostMatch = lower.match(/^(?:https?:)?\/\/([^/:?#\s]+)/);
      if (!hostMatch) {
        // Bare scheme (javascript:/data: already neutralized) or junk — drop.
        if (/^(?:javascript|data|vbscript|file|blob):/.test(lower)) return '';
        return match;
      }
      const host = hostMatch[1];
      const trusted = TRUSTED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
      return trusted ? match : '';
    });

    // 4. Remove entire <p>, <div>, and <a> elements whose text contains spam keywords.
    // Use [\s\S]*? so nested markup (<b>, <span>) before the keyword can't bypass.
    //
    // The tempered `(?!</tag)` lookahead is load-bearing. With a plain [\s\S]*? the
    // match happily spans sibling blocks: a spam keyword inside a later blockquote
    // would let the *earlier* `<p>` swallow everything up to the next `</p>`, so a
    // perfectly innocent quote was deleted along with the spam. The intent is
    // "delete the element that contains the keyword", so the match must not cross
    // the element's own closing tag. This narrows deletion, which cannot weaken
    // the boundary — a keyword still removes its own containing element.
    for (const keyword of SPAM_KEYWORDS) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      for (const tag of ['p', 'div', 'a'] as const) {
        const inner = `(?:(?!<\\/${tag}\\b)[\\s\\S])*?${escaped}(?:(?!<\\/${tag}\\b)[\\s\\S])*?`;
        const pattern =
          tag === 'a'
            ? new RegExp(`<a\\s[^>]*?${inner}<\\/a\\s*>`, 'gi')
            : new RegExp(`<${tag}\\b[^>]*>${inner}<\\/${tag}\\s*>`, 'gi');
        clean = clean.replace(pattern, '');
      }
    }

    // 5. Remove blocks of 3+ consecutive links
    clean = clean.replace(/(<a\s[^>]*?>[\s\S]*?<\/a>\s*){3,}/gi, '');

    // 6. Remove JavaScript event handlers and style attributes: quoted AND unquoted.
    // Unquoted (onload=alert(1), onload=`alert(1)`) previously bypassed the filter.
    clean = clean.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|`[^`]*`|[^\s>]+)/gi, '');
    clean = clean.replace(/\sstyle\s*=\s*(?:"[^"]*"|'[^']*'|`[^`]*`|[^\s>]+)/gi, '');

    // 7. Remove WordPress class names (wp-, elementor-, freshio-, woocommerce, yith-)
    clean = clean.replace(/\bclass\s*=\s*"([^"]*)"/gi, (_match, classValue: string) => {
      const filtered = classValue
        .split(/\s+/)
        .filter(
          (cls) =>
            !cls.startsWith('wp-') &&
            !cls.startsWith('elementor-') &&
            !cls.startsWith('freshio-') &&
            cls !== 'woocommerce' &&
            !cls.startsWith('yith-')
        )
        .join(' ')
        .trim();
      return filtered ? `class="${filtered}"` : '';
    });
    clean = clean.replace(/\bclass\s*=\s*'([^']*)'/gi, (_match, classValue: string) => {
      const filtered = classValue
        .split(/\s+/)
        .filter(
          (cls) =>
            !cls.startsWith('wp-') &&
            !cls.startsWith('elementor-') &&
            !cls.startsWith('freshio-') &&
            cls !== 'woocommerce' &&
            !cls.startsWith('yith-')
        )
        .join(' ')
        .trim();
      return filtered ? `class="${filtered}"` : '';
    });

    // 8. Remove empty paragraphs
    clean = clean.replace(/<p>\s*<\/p>/g, '');

    // 9. Transform embedded images to use Supabase Storage URLs
    // This finds <img src="..."> and ensures the src uses the storage utility
    clean = clean.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, (match, src) => {
      if (!src) return match;
      // If it's already a full URL to a different domain, leave it
      // If it's a relative path or a legacy WordPress path, transform it
      const storageUrl = getStorageUrl(src);
      return match.replace(src, storageUrl);
    });

    return sanitizeHtml(clean, HTML_SANITIZE_OPTIONS);
  } catch (err) {
    console.error('[sanitizeWPContent] Error:', err);
    return '';
  }
}

/**
 * Extracts readable text from CMS HTML for use in meta descriptions and OG cards.
 *
 * Runs the same sanitizer first, so Google Sites navigation chrome can never leak
 * into a SERP snippet. The previous call sites sliced the first 150 characters of
 * the *raw* body, which is how shipped descriptions came to start with
 * "IndivisibleFairOaks.org - Links Search this site Embedded Files…".
 */
export function htmlToExcerpt(html: string, maxLength = 155): string {
  const text = sanitizeWPContent(html)
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '')}…`;
}

/**
 * Sanitizes a plain text string (no HTML) — replaces spam keywords with "..."
 * Used for blog post titles and other non-HTML text fields.
 */
export function sanitizeText(text: string): string {
  if (!text) return '';

  try {
    let clean = text;

    for (const keyword of SPAM_KEYWORDS) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Use word boundary where possible; fall back to plain match for multi-word/special keywords
      const hasWordChars = /^\w+$/.test(keyword);
      const pattern = hasWordChars
        ? new RegExp(`\\b${escaped}\\b`, 'gi')
        : new RegExp(escaped, 'gi');
      clean = clean.replace(pattern, '...');
    }

    return clean;
  } catch (err) {
    console.error('[sanitizeText] Error:', err);
    return '';
  }
}

/**
 * Returns true if the content contains suspicious patterns that warrant
 * manual review (excessive links, encoded strings, foreign spam patterns).
 */
export function hasSuspiciousContent(html: string): boolean {
  if (!html) return false;

  try {
    // More than 5 <a tags
    const linkMatches = html.match(/<a\s/gi);
    if (linkMatches && linkMatches.length > 5) return true;

    // Base64-encoded strings
    if (/data:[^;]+;base64,/.test(html)) return true;

    // URL-encoded sequences appearing 3+ times (obfuscation indicator)
    const urlEncodedMatches = html.match(/%[0-9a-f]{2}/gi);
    if (urlEncodedMatches && urlEncodedMatches.length >= 3) return true;

    return false;
  } catch {
    return false;
  }
}
