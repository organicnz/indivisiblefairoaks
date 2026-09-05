/**
 * Spam-keyword filter — shared across all edge functions.
 *
 * This is a Deno-compatible copy of the relevant portion of
 * src/lib/sanitize.ts. Keep the two files in sync whenever SPAM_KEYWORDS
 * changes; the edge runtime cannot import from the Next.js app source tree.
 */

export const SPAM_KEYWORDS: readonly string[] = [
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
] as const

/**
 * Returns true if `text` contains a spam keyword or suspicious non-Latin
 * characters (same logic as src/lib/sanitize.ts).
 */
export function isSpamContent(text: string): boolean {
    if (!text) return false
    const lowerText = text.toLowerCase()

    const hasSpamKeyword = SPAM_KEYWORDS.some((kw) => lowerText.includes(kw))

    // Non-Latin outside ASCII that isn't part of the org name itself.
    // The \x00-\x7F range is intentional — it detects non-ASCII spam injections.
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional ASCII range
    // eslint-disable-next-line no-control-regex
    const hasNonLatin =
        /[^\x00-\x7F]/.test(text) && !lowerText.includes('indivisible')

    return hasSpamKeyword || hasNonLatin
}
