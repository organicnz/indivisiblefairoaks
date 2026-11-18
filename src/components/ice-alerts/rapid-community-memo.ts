import type { RapidAlert, RapidAlertKind } from './rapid-types';

export type CommunityMemoInput = Pick<
  RapidAlert,
  'kind' | 'status' | 'city' | 'stateCode' | 'observedAt'
>;

const COMMUNITY_TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Los_Angeles',
  timeZoneName: 'short',
});

export function formatCommunityObservedAt(observedAt: string) {
  const timestamp = Date.parse(observedAt);
  if (!Number.isFinite(timestamp)) return 'Time unavailable';

  // Node and Chromium can join Intl parts differently ("Nov 17 at" vs
  // "Nov 17,"). Build the memo from parts so cached server and client renders
  // are byte-for-byte consistent.
  const parts = Object.fromEntries(
    COMMUNITY_TIME_FORMAT.formatToParts(new Date(timestamp)).map((part) => [
      part.type,
      part.value,
    ])
  );

  return `${parts.month} ${parts.day}, ${parts.hour}:${parts.minute} ${parts.dayPeriod} ${parts.timeZoneName}`;
}

/**
 * A short source-log memo built only from fields that are already safe to
 * publish. Raw comments, street addresses, plates, and identities never enter
 * this function, so the same memo can be rendered from a cached snapshot.
 */
export function communityMemo(alert: CommunityMemoInput) {
  const place = `${alert.city}, ${alert.stateCode}`;
  const time = formatCommunityObservedAt(alert.observedAt);
  const confirmed = alert.status === 'source-confirmed';

  return `${place} · ${time} — ${memoBody(alert.kind, confirmed)}`;
}

function memoBody(kind: RapidAlertKind, confirmed: boolean) {
  if (kind === 'detention') {
    return confirmed
      ? 'source-confirmed detention-related activity near a jail or detention facility.'
      : 'community sighting of detention-related activity near a jail or detention facility.';
  }
  if (kind === 'checkpoint') {
    return confirmed
      ? 'source-confirmed checkpoint report.'
      : 'community sighting of a possible checkpoint.';
  }
  return confirmed
    ? 'source-confirmed enforcement activity.'
    : 'community sighting of enforcement activity.';
}
