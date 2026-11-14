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
  'partners',
  'coalition_links',
  'newsletters',
  'gallery_photos',
] as const

export type EventStatus = 'upcoming' | 'recurring' | 'undated' | 'past'

// Weekday names are not recurrence signals. "Saturday, October 17, 2026" is a
// one-off with a date; only an explicit schedule word makes a row recurring.
const RECURRING_LABEL = /\b(every|ongoing|weekly|biweekly|bi-weekly|monthly|daily|recurring)\b/i

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
  'need',
  'our',
  'please',
  'site',
  'tell',
  'that',
  'the',
  'their',
  'them',
  'there',
  'they',
  'this',
  'was',
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
  const haystack = Object.values(row).map((value) => readText(value, 10_000).toLowerCase()).join(' ')
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0)
}

export function isRecurringEvent(row: Record<string, unknown>): boolean {
  return RECURRING_LABEL.test(readText(row.date_label))
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

const SCHEDULE_INTENT =
  /\b(event|events|calendar|schedule|upcoming|next|meeting|gathering|rally|protest|rehearsal|today|tomorrow|weekend|week|month)\b/i
const EVENT_CONTEXT = /\b(choir|music|song|sing|volunteer|canvass|march)\b/i

/** Explicitly date-shaped questions may be answered deterministically. */
export function hasScheduleIntent(message: string): boolean {
  return SCHEDULE_INTENT.test(message)
}

/** Event context also helps general choir, music, and volunteering questions. */
export function hasEventIntent(message: string): boolean {
  return hasScheduleIntent(message) || EVENT_CONTEXT.test(message)
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
