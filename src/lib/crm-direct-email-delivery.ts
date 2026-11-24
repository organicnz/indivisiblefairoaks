import type {
  DirectEmailDelivery,
  DirectEmailDeliveryEvent,
  DirectEmailDeliveryEventType,
} from '@/types/crm';

/**
 * Correlation between a direct-email send and Resend's post-send events.
 *
 * The send activity and its audit row both carry Resend's message id as
 * `resend_id`; every `crm_email_events` row carries the same value as
 * `provider_id`. The id is the join key. No extra table is needed: a Resend
 * message id is unique, and the contact id scopes the lookup to the right
 * recipient.
 */

const DELIVERY_EVENT_TYPES = new Set<DirectEmailDeliveryEventType>([
  'delivered',
  'bounced',
  'complained',
  'suppressed',
]);

interface DeliveryEventRow {
  provider_id: string | null;
  event_type: string;
  occurred_at: string;
}

interface DeliveryResponse {
  data: DeliveryEventRow[] | null;
  error: { message: string } | null;
}

interface DeliveryQuery extends PromiseLike<DeliveryResponse> {
  select(columns: string): DeliveryQuery;
  eq(column: string, value: string): DeliveryQuery;
  in(column: string, values: readonly string[]): DeliveryQuery;
  order(column: string, options?: { ascending?: boolean }): DeliveryQuery;
}

interface DeliveryDatabase {
  from(table: string): DeliveryQuery;
}

/** Extract Resend's id from an audit `after` snapshot or activity metadata. */
export function resendIdFromSnapshot(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const id = (value as { resend_id?: unknown }).resend_id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

function isDeliveryEventType(value: string): value is DirectEmailDeliveryEventType {
  return DELIVERY_EVENT_TYPES.has(value as DirectEmailDeliveryEventType);
}

function firstEventAt(
  events: readonly DirectEmailDeliveryEvent[],
  types: readonly DirectEmailDeliveryEventType[]
): string | null {
  for (const event of events) {
    if (types.includes(event.eventType)) return event.occurredAt;
  }
  return null;
}

/**
 * Fold a send's provider events into one status.
 *
 * A complaint is final and always wins. Otherwise the latest delivery outcome
 * wins, so a temporary bounce that was followed by a delivery reads delivered
 * rather than stuck at bounced. Every observed stage remains in `events` and
 * its timestamp field. Accepted is the floor: the activity/audit row exists
 * only after Resend accepted the message.
 */
export function summarizeDirectEmailDelivery(
  rows: readonly Pick<DeliveryEventRow, 'event_type' | 'occurred_at'>[],
  acceptedAt: string | null
): DirectEmailDelivery {
  const events = rows
    .filter((row) => isDeliveryEventType(row.event_type))
    .map((row) => ({
      eventType: row.event_type as DirectEmailDeliveryEventType,
      occurredAt: row.occurred_at,
    }))
    .sort((a, b) => {
      const aTime = Date.parse(a.occurredAt);
      const bTime = Date.parse(b.occurredAt);
      if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
      return aTime - bTime;
    });

  const deliveredAt = firstEventAt(events, ['delivered']);
  const bouncedAt = firstEventAt(events, ['bounced', 'suppressed']);
  const complainedAt = firstEventAt(events, ['complained']);
  const latestDeliveryOutcome = [...events]
    .reverse()
    .find(
      (event) =>
        event.eventType === 'delivered' ||
        event.eventType === 'bounced' ||
        event.eventType === 'suppressed'
    );
  const status = complainedAt
    ? 'complained'
    : latestDeliveryOutcome?.eventType === 'delivered'
      ? 'delivered'
      : latestDeliveryOutcome
        ? 'bounced'
        : 'accepted';

  return {
    status,
    acceptedAt,
    deliveredAt,
    bouncedAt,
    complainedAt,
    events,
  };
}

/**
 * Read the correlated delivery state for a set of direct sends.
 *
 * One query covers every send on a timeline page; the caller groups by provider
 * id. A provider id with no events still gets an `accepted` summary, so the
 * timeline can show the send's current stage without pretending delivery has
 * happened.
 */
export async function getDirectEmailDeliveries(
  adminClient: unknown,
  {
    contactId,
    providerIds,
    acceptedAtByProvider,
  }: {
    contactId: string;
    providerIds: readonly (string | null | undefined)[];
    acceptedAtByProvider: ReadonlyMap<string, string | null>;
  }
): Promise<Map<string, DirectEmailDelivery>> {
  const ids = [
    ...new Set(
      providerIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    ),
  ];
  if (ids.length === 0) return new Map();

  const { data, error } = await (adminClient as DeliveryDatabase)
    .from('crm_email_events')
    .select('provider_id, event_type, occurred_at')
    .eq('contact_id', contactId)
    .in('provider_id', ids)
    .in('event_type', [...DELIVERY_EVENT_TYPES])
    .order('occurred_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to read direct-email delivery events: ${error.message}`);
  }

  const rowsByProvider = new Map<string, DeliveryEventRow[]>();
  for (const row of data ?? []) {
    if (!row.provider_id || !ids.includes(row.provider_id)) continue;
    const rows = rowsByProvider.get(row.provider_id) ?? [];
    rows.push(row);
    rowsByProvider.set(row.provider_id, rows);
  }

  return new Map(
    ids.map((id) => [
      id,
      summarizeDirectEmailDelivery(
        rowsByProvider.get(id) ?? [],
        acceptedAtByProvider.get(id) ?? null
      ),
    ])
  );
}

/** Read one direct send's delivery state, including the accepted-only case. */
export async function getDirectEmailDelivery(
  adminClient: unknown,
  {
    contactId,
    providerId,
    acceptedAt,
  }: {
    contactId: string;
    providerId: string;
    acceptedAt: string | null;
  }
): Promise<DirectEmailDelivery> {
  const deliveries = await getDirectEmailDeliveries(adminClient, {
    contactId,
    providerIds: [providerId],
    acceptedAtByProvider: new Map([[providerId, acceptedAt]]),
  });
  return deliveries.get(providerId) ?? summarizeDirectEmailDelivery([], acceptedAt);
}
