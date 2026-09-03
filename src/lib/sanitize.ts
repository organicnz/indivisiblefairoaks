/**
 * Shared sanitization utilities for WordPress-migrated and user-generated content.
 * All functions are fail-safe: they never throw and return '' on error.
 */
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
  'hamandtys.com',
  'bayofplentyboathire.co.nz',
  'nzangler.co.nz',
  'seacleaners.org.nz',
  'givealittle.co.nz',
] as const;

/**
 * Utility to check if a given string contains spam keywords or non-latin characters.
 * Used for aggressively filtering out malicious injections or spam pages.
 */
export function isSpamContent(text: string): boolean {
  if (!text) return false;
  const lowerText = text.toLowerCase();

  // Check for spam keywords
  const hasSpamKeyword = SPAM_KEYWORDS.some((kw) => lowerText.includes(kw));

  // Check for non-Latin characters (strict ASCII check)
  const hasNonLatin =
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional ASCII range check
    /[^\x00-\x7F]/.test(text) &&
    !lowerText.includes('catch-22') &&
    !lowerText.includes('indivisible');

  return hasSpamKeyword || hasNonLatin;
}

/**
 * Removes WordPress artifacts, spam content, and XSS vectors from HTML strings.
 * Safe to call on any user-generated or legacy-migrated content.
 */
export function sanitizeWPContent(html: string): string {
  if (!html) return '';

  try {
    let clean = html;

    // 0. Strip active-content vectors BEFORE anything else. Callers inject
    // this output as raw HTML into the page, so script/iframe/plugin/embed
    // elements and script-scheme URLs must never survive sanitization.
    clean = clean.replace(/<script[\s\S]*?<\/script>/gi, '');
    clean = clean.replace(
      /<\/?(?:script|iframe|object|embed|form|input|select|textarea|button|link|meta|base)\b[^>]*>/gi,
      ''
    );
    clean = clean.replace(
      /(\s(?:href|src|xlink:href)\s*=\s*)(?:"\s*(?:javascript|data|vbscript):[^"]*"|'\s*(?:javascript|data|vbscript):[^']*')/gi,
      '$1"#"'
    );

    // 1. Remove Gutenberg block comments: <!-- wp:... --> and <!-- /wp:... -->
    clean = clean.replace(/<!--\s*\/?wp:[\s\S]*?-->/g, '');

    // 2. Replace [wpforms...] shortcodes with a styled contact div
    clean = clean.replace(
      /\[wpforms[^\]]*\]/gi,
      '<div class="p-4 bg-slate-50 border border-slate-100 rounded-2xl my-8 text-secondary font-bold uppercase tracking-widest text-xs text-center">Please use our official <a href="/contact" class="text-primary underline">Contact Page</a> to reach out.</div>'
    );

    // 3. Remove untrusted external links (http/https links not matching trusted domains)
    const trustedDomainsPattern = TRUSTED_DOMAINS.map((d) =>
      d.replace(/\./g, '\\.').replace(/-/g, '\\-')
    ).join('|');
    const untrustedLinkRegex = new RegExp(
      `<a\\s[^>]*?href=["'](https?:\\/\\/(?!(${trustedDomainsPattern}))[^"']+)["'][^>]*?>[\\s\\S]*?<\\/a>`,
      'gi'
    );
    clean = clean.replace(untrustedLinkRegex, '');

    // 4. Remove entire <p>, <div>, and <a> elements whose text contains spam keywords
    for (const keyword of SPAM_KEYWORDS) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pRegex = new RegExp(`<p>[^<]*${escaped}[\\s\\S]*?<\\/p>`, 'gi');
      const divRegex = new RegExp(`<div[^>]*>[^<]*${escaped}[\\s\\S]*?<\\/div>`, 'gi');
      const aRegex = new RegExp(`<a[^>]*>[^<]*${escaped}[\\s\\S]*?<\\/a>`, 'gi');
      clean = clean.replace(pRegex, '');
      clean = clean.replace(divRegex, '');
      clean = clean.replace(aRegex, '');
    }

    // 5. Remove blocks of 3+ consecutive links
    clean = clean.replace(/(<a\s[^>]*?>[\s\S]*?<\/a>\s*){3,}/gi, '');

    // 6. Remove JavaScript event handler attributes: on[a-z]+="..." or on[a-z]+='...'
    clean = clean.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');

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
      // If it's a relative path or an old Catch-22 path, transform it
      const storageUrl = getStorageUrl(src);
      return match.replace(src, storageUrl);
    });

    return clean;
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
