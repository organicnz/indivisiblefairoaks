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

    // 0. Strip active-content elements WITH their bodies first. Callers inject
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
    for (const keyword of SPAM_KEYWORDS) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pRegex = new RegExp(`<p\\b[^>]*>[\\s\\S]*?${escaped}[\\s\\S]*?<\\/p\\s*>`, 'gi');
      const divRegex = new RegExp(`<div\\b[^>]*>[\\s\\S]*?${escaped}[\\s\\S]*?<\\/div\\s*>`, 'gi');
      const aRegex = new RegExp(`<a\\b[^>]*>[\\s\\S]*?${escaped}[\\s\\S]*?<\\/a\\s*>`, 'gi');
      clean = clean.replace(pRegex, '');
      clean = clean.replace(divRegex, '');
      clean = clean.replace(aRegex, '');
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
