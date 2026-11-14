// Shared freshness rules for WALL-E.
//
// WALL-E answers questions about a live chapter. A row being present is not the
// same as a row being current: the events table keeps history, and the retired
// store snapshot can outlive the store itself. These helpers keep one definition
// of "current" for both the live retrieval path and the scheduled snapshots.

export const WALLE_TIME_ZONE = 'America/Los_Angeles'
export const SNAPSHOT_MAX_AGE_MS = 48 * 60 * 60 * 1000

/** Snapshot sources that still correspond to a live public surface. */
export const WALLE_SNAPSHOT_SOURCES = [
  'content',
  'events',
  'data_points',
  'faqs',
  'partners',
  'coalition_links',
  'newsletters',
  'gallery_photos',
] as const

/**
 * Data-point namespaces that carry public page copy or facts.
 *
 * The table also stores admin dashboards, account settings, store remnants,
 * WALL-E's own widget copy, and form labels. Retrieval must never answer a
 * visitor from those rows, even though RLS makes them readable to the edge
 * function. This allowlist is the boundary.
 */
const PUBLIC_DATA_POINT_PREFIXES = [
  'home.',
  'about.',
  'choir.',
  'voter.',
  'events.',
  'news.',
  'faqs.',
  'partners.',
  'links.',
  'gallery.',
  'footer.',
  'contact.',
  'donate.',
  'site.',
  'nav.',
  'header.',
  'archive.',
] as const

/** UI-only key shapes that are not useful source material for an answer. */
const UI_DATA_POINT_KEY =
  /(?:^|[._])(?:btn|button|placeholder|aria|tooltip|tab|status|form|input|submit)(?:[._]|$)/i

const DATA_POINT_PATHS: Readonly<Record<string, string>> = {
  'home.': '/',
  'about.': '/about',
  'choir.': '/choir',
  'voter.': '/voter-info',
  'events.': '/events',
  'news.': '/news',
  'faqs.': '/faqs',
  'partners.': '/partners',
  'links.': '/links',
  'gallery.': '/gallery',
  'footer.': '/contact',
  'contact.': '/contact',
  'donate.': '/donate',
  'site.': '/',
  'nav.': '/',
  'header.': '/',
  'archive.': '/archive',
}

const COPY_REGION_PATHS: Readonly<Record<string, string>> = {
  'home-': '/',
  'about-': '/about',
  'voter-': '/voter-info',
  'choir-': '/choir',
  'donate-': '/donate',
  'events-': '/events',
}

/** True for a public, non-UI data point that can answer a visitor. */
export function isPublicDataPointKey(key: unknown): boolean {
  const clean = readText(key, 120).toLowerCase()
  if (!clean.includes('.') || UI_DATA_POINT_KEY.test(clean)) return false
  return PUBLIC_DATA_POINT_PREFIXES.some((prefix) => clean.startsWith(prefix))
}

/** The public page that renders a data point. */
export function dataPointPath(key: unknown): string {
  const clean = readText(key, 120).toLowerCase()
  const prefix = PUBLIC_DATA_POINT_PREFIXES.find((candidate) => clean.startsWith(candidate))
  return prefix ? (DATA_POINT_PATHS[prefix] ?? '/') : '/'
}

/** The public page whose copy region a `copy-*` row renders, or null. */
export function copyRegionPath(slug: unknown): string | null {
  const clean = readText(slug, 120).toLowerCase()
  if (!clean.startsWith('copy-')) return null
  const id = clean.slice('copy-'.length)
  if (!id) return null
  const prefix = Object.keys(COPY_REGION_PATHS).find((candidate) => id.startsWith(candidate))
  return prefix ? COPY_REGION_PATHS[prefix] : null
}

// "Every voter" and "every dollar" are not schedules. Every/each needs a
// following recurrence unit, weekday, or ordinal to qualify.
const SCHEDULE_FACT_RECURRENCE =
  /\b(weekly|biweekly|bi-weekly|monthly|bimonthly|bi-monthly|fortnightly|daily|recurring|ongoing)\b/i
const SCHEDULE_FACT_EVERY =
  /\b(?:every|each)\s+(?:(?:other|single)\s+)?(?:week|weeks|weekend|weekends|month|months|year|years|day|days|morning|mornings|afternoon|afternoons|evening|evenings|monday|tuesday|wednesday|thursday|friday|saturday|sunday|first|second|third|fourth|fifth|last|\d{1,2}(?:st|nd|rd|th)?)\b/i
const SCHEDULE_FACT_ORDINAL = /\b(first|second|third|fourth|fifth|last)\b/i
const SCHEDULE_FACT_WORD =
  /\b(schedule|meet|meets|meeting|meetings|gather|gathers|gathering|gatherings|rehearsal|rehearsals)\b/i
const SCHEDULE_FACT_TIME =
  /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))\b/i
const SCHEDULE_FACT_PLACE =
  /\b(church|hall|center|centre|avenue|ave\.?|street|st\.?|boulevard|blvd\.?|road|rd\.?|drive|dr\.?|park|library|zoom|online|carmichael|fair oaks|sacramento)\b/i

/** A recurring schedule or venue statement, not a dated event occurrence. */
export function isScheduleFactText(value: unknown): boolean {
  const text = readText(value, 2_000)
  return (
    SCHEDULE_FACT_RECURRENCE.test(text) ||
    SCHEDULE_FACT_EVERY.test(text) ||
    (SCHEDULE_FACT_ORDINAL.test(text) &&
      (SCHEDULE_FACT_TIME.test(text) || SCHEDULE_FACT_WORD.test(text))) ||
    (SCHEDULE_FACT_WORD.test(text) &&
      (SCHEDULE_FACT_TIME.test(text) || SCHEDULE_FACT_PLACE.test(text)))
  )
}

export type EventStatus = 'upcoming' | 'recurring' | 'undated' | 'past'

/**
 * Published content rows whose copy is a stale duplicate of a live surface:
 * legacy event listings, the old choir/voter/news/link pages, and the retired
 * shipping policy. The live route or the events table is authoritative for
 * these topics. Keep this aligned with docs/content-row-disposition.md.
 */
const SHADOWED_CONTENT_SLUGS = new Set([
  // Legacy Google Sites paths.
  'home',
  'about-us',
  'current-events',
  'upcoming-events',
  'good-trouble',
  'weekend-of-protest-song',
  'upcoming-fall-events',
  'resistance-choir',
  'voter-information',
  'newsletters',
  'coalition-links',
  // App Router segments whose pages are coded, not rendered from `content`.
  'about',
  'account',
  'admin',
  'api',
  'archive',
  'auth',
  'cancel',
  'cart',
  'checkout',
  'compose',
  'choir',
  'contact',
  'donate',
  'events',
  'faqs',
  'gallery',
  'ice-alerts',
  'links',
  'login',
  'news',
  'partners',
  'privacy-policy',
  'products',
  'search',
  'shipping-returns',
  'success',
  'terms-and-conditions',
  'voter-info',
  'wishlist',
])

// Weekday names are not recurrence signals. "Saturday, October 17, 2026" is a
// one-off with a date; only an explicit schedule word makes a row recurring.
const RECURRING_LABEL =
  /\b(every|each|ongoing|weekly|biweekly|bi-weekly|monthly|bimonthly|bi-monthly|fortnightly|daily|recurring|(?:first|second|third|fourth|fifth|last)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i

/** The same recurrence vocabulary, expressed as PostgREST ILIKE filters. */
// `%each%` also matches "beach" and "teach-in"; a broad ILIKE there can fill
// the 100-row window with historical rows and starve a real upcoming event.
// Match a recurring word only at the start or after a space.
const RECURRING_LABEL_FILTERS = [
  'date_label.ilike.every%',
  'date_label.ilike.% every%',
  'date_label.ilike.each%',
  'date_label.ilike.% each%',
  'date_label.ilike.ongoing%',
  'date_label.ilike.% ongoing%',
  'date_label.ilike.weekly%',
  'date_label.ilike.% weekly%',
  'date_label.ilike.biweekly%',
  'date_label.ilike.% biweekly%',
  'date_label.ilike.bi-weekly%',
  'date_label.ilike.% bi-weekly%',
  'date_label.ilike.monthly%',
  'date_label.ilike.% monthly%',
  'date_label.ilike.bimonthly%',
  'date_label.ilike.% bimonthly%',
  'date_label.ilike.bi-monthly%',
  'date_label.ilike.% bi-monthly%',
  'date_label.ilike.fortnightly%',
  'date_label.ilike.% fortnightly%',
  'date_label.ilike.daily%',
  'date_label.ilike.% daily%',
  'date_label.ilike.recurring%',
  'date_label.ilike.% recurring%',
  // "First Tuesday of the month" is recurring even without the word "every".
  'date_label.ilike.% first%',
  'date_label.ilike.% second%',
  'date_label.ilike.% third%',
  'date_label.ilike.% fourth%',
  'date_label.ilike.% fifth%',
  'date_label.ilike.% last%',
] as const

/**
 * Common question words and site-wide nouns are not retrieval signals. Leaving
 * them in made "chapter" match almost every page, which could fill all eight
 * source slots before a single event row was considered.
 */
const STOP_WORDS = new Set([
  'about',
  'and',
  'any',
  'are',
  'can',
  'chapter',
  'could',
  'does',
  'for',
  'from',
  'get',
  'have',
  'help',
  'how',
  'indivisible',
  'info',
  'information',
  'into',
  'know',
  'local',
  'month',
  'need',
  'next',
  'our',
  'please',
  'scheduled',
  'site',
  'tell',
  'that',
  'the',
  'their',
  'them',
  'there',
  'they',
  'this',
  'today',
  'tomorrow',
  'upcoming',
  'was',
  'week',
  'weekend',
  'website',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'will',
  'with',
  'would',
  'you',
  'your',
])

export function readText(value: unknown, max = 500): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/** Columns that describe a row rather than answer a visitor's question. */
const STRUCTURAL_KEYS = new Set([
  'slug',
  'type',
  'status',
  'is_hidden',
  '_status',
  'created_at',
  'updated_at',
  'published_at',
])

export function isUnreachableContentSlug(slug: unknown): boolean {
  const clean = readText(slug, 120).toLowerCase()
  return !clean || clean.startsWith('copy-') || SHADOWED_CONTENT_SLUGS.has(clean)
}

export function meaningfulTerms(message: string, max = 8): string[] {
  const words = message
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  return [...new Set(words.filter((word) => word.length > 2 && !STOP_WORDS.has(word)))].slice(
    0,
    max
  )
}

export function keywordScore(row: Record<string, unknown>, terms: readonly string[]): number {
  if (terms.length === 0) return 0

  // Bodies are HTML. Scoring raw markup let tags and attributes count as
  // matches, and exact substring checks missed ordinary plural forms. Strip
  // the markup and compare stemmed tokens instead.
  const haystack = Object.entries(row)
    .filter(([key]) => !STRUCTURAL_KEYS.has(key))
    .map(([, value]) =>
      readText(value, 10_000)
        .replace(/<[^>]*>/g, ' ')
        .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/gi, ' ')
        .toLowerCase()
    )
    .join(' ')
  const tokens = new Set(
    haystack
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .map(stemSearchWord)
  )

  return terms.reduce((score, term) => {
    const variants = term
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2)
      .map(stemSearchWord)
    if (!variants.length) return score
    const matched = variants.some((variant) =>
      [...tokens].some((token) => tokenMatches(token, variant))
    )
    return score + (matched ? 1 : 0)
  }, 0)
}

function stemSearchWord(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3)
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2)
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2)
  if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1)
  return word
}

function tokenMatches(token: string, term: string): boolean {
  if (token === term) return true
  const shorter = token.length < term.length ? token : term
  const longer = token.length < term.length ? term : token
  // Allow a small suffix difference (schedule/scheduled, voter/voters), but
  // not an unrelated word that merely starts with the same letters.
  return shorter.length >= 4 && longer.startsWith(shorter) && longer.length - shorter.length <= 3
}

export function isRecurringEvent(row: Record<string, unknown>): boolean {
  return RECURRING_LABEL.test(readText(row.date_label))
}

/**
 * PostgREST filter selecting rows that can still be current. Past one-offs are
 * excluded in the database rather than after a limit has already filled with
 * history, which is what made a current event disappear from WALL-E's context.
 */
export function currentEventOrFilter(now = new Date()): string {
  const iso = now.toISOString()
  return [
    `ends_at.gte.${iso}`,
    `and(ends_at.is.null,starts_at.gte.${iso})`,
    `and(ends_at.is.null,starts_at.is.null)`,
    ...RECURRING_LABEL_FILTERS,
  ].join(',')
}

function timestamp(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * The event's end is what makes it past. A row with no stored instant is kept
 * and labelled `undated` rather than guessed into either direction.
 */
export function eventStatus(row: Record<string, unknown>, now = new Date()): EventStatus {
  if (isRecurringEvent(row)) return 'recurring'
  const end = timestamp(row.ends_at) ?? timestamp(row.starts_at)
  if (end === null) return 'undated'
  return end >= now.getTime() ? 'upcoming' : 'past'
}

/**
 * Current means "not past". Future one-offs come first, then recurring rows
 * whose stored reference date may be old, then undated rows. Duplicate rows for
 * the same instant are collapsed only when their titles also describe the same
 * gathering: the Mobilize importer and the hand-written monthly meeting can
 * describe one event twice, but two different events can legitimately share a
 * start time.
 */
export function selectCurrentEvents(
  rows: readonly Record<string, unknown>[],
  now = new Date(),
  limit = 6
): Array<Record<string, unknown> & { _status: EventStatus }> {
  const candidates = rows
    .filter((row) => row.is_hidden !== true)
    .map((row) => ({ row, status: eventStatus(row, now) }))
    .filter(({ status }) => status !== 'past')

  candidates.sort((a, b) => {
    const rank = (status: EventStatus) => (status === 'upcoming' ? 0 : status === 'recurring' ? 1 : 2)
    const byRank = rank(a.status) - rank(b.status)
    if (byRank !== 0) return byRank
    const aStart = timestamp(a.row.starts_at) ?? Number.POSITIVE_INFINITY
    const bStart = timestamp(b.row.starts_at) ?? Number.POSITIVE_INFINITY
    return aStart - bStart
  })

  const seen = new Map<string, string[]>()
  const selected: Array<Record<string, unknown> & { _status: EventStatus }> = []
  for (const { row, status } of candidates) {
    const start = timestamp(row.starts_at)
    const title = comparableTitle(row)
    const key = start === null ? 'recurring' : `instant:${start}`
    const titles = seen.get(key) ?? []
    if (titles.some((previous) => titlesOverlap(previous, title))) continue
    titles.push(title)
    seen.set(key, titles)
    selected.push({ ...row, _status: status })
    if (selected.length >= limit) break
  }
  return selected
}

function comparableTitle(row: Record<string, unknown>): string {
  return readText(row.title, 200)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(imported|indivisible|fair|oaks|carmichael|chapter|monthly|the|and|of|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titlesOverlap(a: string, b: string): boolean {
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

const EVENT_NOUN =
  /\b(events?|calendar|schedules?|meet(?:ings?|s)?|gatherings?|rall(?:y|ies)|protests?|rehears(?:al|als|e|es|ing)?|canvass(?:ing)?|actions?|volunteer(?:ing)?|phone[ -]?bank(?:ing)?|postcard(?:ing)?|happening(?:s)?)\b/i
const SCHEDULE_TIME =
  /\b(today|tonight|tomorrow|this (?:week|weekend|month|morning|afternoon|evening)|next (?:week|weekend|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|upcoming|coming up|when(?:'s| is| are)?|what time|date|day|(?:meetings?|events?|gatherings?|rehearsals?|rall(?:y|ies)|protests?)\s+(?:time|location|place))\b/i
const MONTH_OR_DATE =
  /\b(?:january|february|march|april|june|july|august|september|october|november|december)\b|\b(?:in|on|this|next|for|during)\s+(?:may|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+\d{1,2}(?:,\s*\d{4})?\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b20\d{2}\b/i
const LOCATION_EVENT =
  /\b(events?|meet(?:ings?|s)?|gatherings?|rall(?:y|ies)|protests?|rehears(?:al|als|e|es|ing)?)\b/i
const WHERE_QUESTION = /\bwhere(?:'s| is| are)?\b/i
const EXPLICIT_SCHEDULE =
  /\b(calendar|schedules?|upcoming events?|next event|next meeting|events? this|events? next|events? on|are there (?:any )?events?|(?:do|does) (?:you|we|the chapter) have (?:any )?events?|anything (?:coming up|this (?:week|weekend|month)(?!'s))|what(?:'s| is) on (?:the )?(?:calendar|this (?:week|weekend)(?!'s)|today|tonight|tomorrow)|what(?:'s| is) (?:happening|coming up)(?! (?:with\b|in (?:the )?newsletter\b)))\b/i
const BARE_EVENT_QUERY = /^\s*(?:any|upcoming|next)\s+events?\s*\?*\s*$/i
const EVENT_INVENTORY =
  /\bwhat\s+(?:upcoming\s+)?events?\s+(?:do\s+(?:you|we|the chapter)\s+have|are\s+(?:there|happening|scheduled|coming))\b/i
// "What's happening with the November ballot?" is a civic question, not a
// calendar one. The month plus a broad event noun can otherwise force it onto
// the deterministic calendar path and answer it with "no upcoming events".
const NON_CALENDAR_TOPIC =
  /\b(ballot|election|newsletter|news|legislation|bill|policy|candidates?|voter registration|voting rights)\b/i
const EVENT_CONTEXT = /\b(choir|music|song|sing|volunteer|canvass|march)\b/i

/** Explicitly date-shaped questions may be answered deterministically. */
export function hasScheduleIntent(message: string): boolean {
  const text = message.toLowerCase().replace(/[’‘]/g, "'")
  if (EXPLICIT_SCHEDULE.test(text) || BARE_EVENT_QUERY.test(text) || EVENT_INVENTORY.test(text)) {
    return true
  }
  // "Next" or "this week" alone is not a calendar question. Require an event
  // noun as well, so "What's next for the chapter?" and "this week's
  // newsletter" stay on the ordinary retrieval path.
  return (
    EVENT_NOUN.test(text) &&
    !NON_CALENDAR_TOPIC.test(text) &&
    (SCHEDULE_TIME.test(text) ||
      MONTH_OR_DATE.test(text) ||
      (LOCATION_EVENT.test(text) && WHERE_QUESTION.test(text)))
  )
}

/** Event context also helps general choir, music, and volunteering questions. */
export function hasEventIntent(message: string): boolean {
  return hasScheduleIntent(message) || EVENT_NOUN.test(message) || EVENT_CONTEXT.test(message)
}

const CURRENT_DATE_QUESTION =
  /\b(?:what(?:'s| is) (?:the )?(?:current )?date|what(?:'s| is) (?:the )?time|what day is (?:it|today)|today'?s date|current date|what time is it|current time|what year is it|current year)\b(?!\s+(?:of|for|on)\b)/i
// The clock answers "now", not "tomorrow" or "next week". Those questions
// must stay on the retrieval path instead of being answered with today's date.
const RELATIVE_DATE_QUESTION =
  /\b(?:tomorrow|yesterday|next\s+(?:week|weekend|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this\s+(?:week|weekend|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|last\s+(?:week|weekend|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i

/** A question that the system clock itself can answer, without retrieval. */
export function hasCurrentDateIntent(message: string): boolean {
  return CURRENT_DATE_QUESTION.test(message.replace(/[’‘]/g, "'"))
}

/** True only when the clock is the whole question, not one clause of a mixed one. */
export function isCurrentDateOnlyQuestion(message: string): boolean {
  if (!hasCurrentDateIntent(message)) return false
  if (RELATIVE_DATE_QUESTION.test(message)) return false
  const terms = meaningfulTerms(message)
  return (
    terms.length > 0 &&
    terms.every((term) =>
      [
        'current',
        'date',
        'day',
        'time',
        'year',
        'pacific',
        'timezone',
        'now',
        'right',
        // The chapter's local place names still describe the same clock, so
        // "What time is it in Fair Oaks?" can be answered deterministically.
        'fair',
        'oaks',
        'carmichael',
        'sacramento',
        'california',
      ].includes(term)
    )
  )
}

export function formatPacificNow(now = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: WALLE_TIME_ZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(now)
}

export function snapshotIsFresh(refreshedAt: unknown, now = new Date()): boolean {
  const refreshed = timestamp(refreshedAt)
  return refreshed !== null && now.getTime() - refreshed <= SNAPSHOT_MAX_AGE_MS && refreshed <= now.getTime() + 60_000
}
