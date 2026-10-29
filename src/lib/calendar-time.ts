// Pacific wall-time helpers for calendar links — issue #149.
//
// Event instants live in `events.starts_at` / `ends_at` as UTC ISO strings.
// Google Calendar links carry `ctz=America/Los_Angeles` and .ics downloads
// carry `TZID=America/Los_Angeles` with a VTIMEZONE block, so both surfaces
// must consume Pacific *wall* stamps (`YYYYMMDDTHHMMSS`, no `Z`): a stamp
// without a zone is reinterpreted in the viewer's clock, which is how Pacific
// users got 2:30 AM for the 6:30 PM November meeting.
//
// All zone math is `Intl.DateTimeFormat` — no timezone library. The zone is
// passed explicitly on every format, so the Vercel runtime's own `TZ` can
// never change the output (the previous `getHours()`-based formatter computed
// whatever zone the server happened to run in, a nondeterministic gate).
//
// Ambiguous or nonexistent wall times (the DST edges) are resolved
// deterministically, matching the "once, clearly" need of a chapter meeting:
// an ambiguous fall-back wall time resolves to the post-transition instant,
// and a nonexistent spring-forward wall time shifts to the next real instant —
// the same semantics as Java's default zone rules.

export const PACIFIC_TZ = 'America/Los_Angeles';

interface WallParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

const WALL_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: PACIFIC_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function wallParts(date: Date): WallParts {
  const parts = {} as WallParts;
  for (const part of WALL_FORMAT.formatToParts(date)) {
    if (part.type !== 'literal') {
      parts[part.type as keyof WallParts] = part.value;
    }
  }
  return parts;
}

/**
 * Stored UTC instant → `YYYYMMDDTHHMMSS` in Pacific wall time — the shape the
 * Google Calendar `dates=` parameter and `.ics` `DTSTART;TZID=` both consume.
 * Empty string for null or unparseable input, matching the field's previous
 * contract.
 */
export function instantToPacificBasic(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = wallParts(date);
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

/**
 * Stored UTC instant → `YYYY-MM-DDTHH:mm`, the `datetime-local` value the
 * event editor's inputs display. Always Pacific, so an organizer on any
 * device sees the chapter's clock, not their laptop's.
 */
export function instantToPacificInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = wallParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Minutes east of UTC the Pacific zone sits at the given instant (PST −480, PDT −420). */
function pacificOffsetMinutes(atMs: number): number {
  const date = new Date(atMs);
  const parts = wallParts(date);
  const wallAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return (wallAsUtc - atMs) / 60_000;
}

/**
 * `datetime-local` value → the UTC instant it designates, read as Pacific
 * wall time. This is the write-path counterpart of `instantToPacificInput`:
 * an organizer typing `18:30` means 6:30 PM Pacific, whether or not their
 * device is in Pacific (the previous `new Date(value)` read the string in the
 * *device's* zone and silently corrupted the stored instant).
 *
 * The offset is guessed from midday on the wall date (civil midday is never
 * inside a transition) and then verified against the candidate instant, which
 * pins the two DST edges: the re-check is the difference between a correct
 * conversion and an instant that flipped the transition the other way. Returns
 * empty string for missing or non-`datetime-local` input.
 */
export function pacificWallToInstant(wall: string): string {
  // `YYYY-MM-DD[ T]HH:mm[:ss]` — the `datetime-local` serialisation.
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(wall.trim());
  if (!match) return '';
  const [, year, month, day, hour, minute, second] = match;
  const naiveUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? '0')
  );
  const guess = pacificOffsetMinutes(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
  let candidate = naiveUtc - guess * 60_000;
  const actual = pacificOffsetMinutes(candidate);
  if (actual !== guess) {
    candidate = naiveUtc - actual * 60_000;
  }
  return new Date(candidate).toISOString();
}

/**
 * RFC 5545 `VTIMEZONE` lines for Pacific. `TZID=` alone is accepted by the
 * large clients but is not an interoperable reference without this block —
 * shipping the zone definition is what makes the download valid iCalendar,
 * not merely "works in the three clients tested". US rules: daylight on the
 * 2nd Sunday of March, standard on the 1st Sunday of November, both flipping
 * at 02:00 local.
 */
export const PACIFIC_VTIMEZONE_LINES: readonly string[] = [
  'BEGIN:VTIMEZONE',
  `TZID:${PACIFIC_TZ}`,
  'BEGIN:DAYLIGHT',
  'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'TZOFFSETFROM:-0800',
  'TZOFFSETTO:-0700',
  'TZNAME:PDT',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'TZOFFSETFROM:-0700',
  'TZOFFSETTO:-0800',
  'TZNAME:PST',
  'END:STANDARD',
  'END:VTIMEZONE',
];
