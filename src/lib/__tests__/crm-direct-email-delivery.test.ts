// @vitest-environment node
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getDirectEmailDeliveries,
  getDirectEmailDelivery,
  resendIdFromSnapshot,
  summarizeDirectEmailDelivery,
} from '@/lib/crm-direct-email-delivery';
import { createMockAdminClient } from './supabase-mock';

const ACCEPTED_AT = '2026-11-20T12:00:00.000Z';

describe('direct-email delivery correlation', () => {
  it('starts at accepted when Resend has reported no post-send event', () => {
    const delivery = summarizeDirectEmailDelivery([], ACCEPTED_AT);

    expect(delivery).toEqual({
      status: 'accepted',
      acceptedAt: ACCEPTED_AT,
      deliveredAt: null,
      bouncedAt: null,
      complainedAt: null,
      events: [],
    });
  });

  it('separates delivered from accepted', () => {
    const delivery = summarizeDirectEmailDelivery(
      [{ event_type: 'delivered', occurred_at: '2026-11-20T12:01:00.000Z' }],
      ACCEPTED_AT
    );

    expect(delivery.status).toBe('delivered');
    expect(delivery.deliveredAt).toBe('2026-11-20T12:01:00.000Z');
  });

  it('keeps every observed stage while the most severe state wins', () => {
    const delivery = summarizeDirectEmailDelivery(
      [
        { event_type: 'complained', occurred_at: '2026-11-20T12:05:00.000Z' },
        { event_type: 'delivered', occurred_at: '2026-11-20T12:01:00.000Z' },
      ],
      ACCEPTED_AT
    );

    expect(delivery.status).toBe('complained');
    expect(delivery.deliveredAt).toBe('2026-11-20T12:01:00.000Z');
    expect(delivery.complainedAt).toBe('2026-11-20T12:05:00.000Z');
    // The provider events are chronological even though the input was newest
    // first; the audit panel should tell the story in order.
    expect(delivery.events.map((event) => event.eventType)).toEqual(['delivered', 'complained']);
  });

  it('lets a later delivery supersede an earlier bounce', () => {
    const delivery = summarizeDirectEmailDelivery(
      [
        { event_type: 'bounced', occurred_at: '2026-11-20T12:01:00.000Z' },
        { event_type: 'delivered', occurred_at: '2026-11-20T12:02:00.000Z' },
      ],
      ACCEPTED_AT
    );

    expect(delivery.status).toBe('delivered');
    expect(delivery.bouncedAt).toBe('2026-11-20T12:01:00.000Z');
    expect(delivery.deliveredAt).toBe('2026-11-20T12:02:00.000Z');
  });

  it('shows a bounce that arrives after delivery as the current state', () => {
    const delivery = summarizeDirectEmailDelivery(
      [
        { event_type: 'delivered', occurred_at: '2026-11-20T12:01:00.000Z' },
        { event_type: 'bounced', occurred_at: '2026-11-20T12:02:00.000Z' },
      ],
      ACCEPTED_AT
    );

    expect(delivery.status).toBe('bounced');
  });

  it('treats a Resend suppression as a bounced state and ignores engagement events', () => {
    const delivery = summarizeDirectEmailDelivery(
      [
        { event_type: 'opened', occurred_at: '2026-11-20T12:02:00.000Z' },
        { event_type: 'suppressed', occurred_at: '2026-11-20T12:03:00.000Z' },
      ],
      ACCEPTED_AT
    );

    expect(delivery.status).toBe('bounced');
    expect(delivery.bouncedAt).toBe('2026-11-20T12:03:00.000Z');
    expect(delivery.events).toEqual([
      { eventType: 'suppressed', occurredAt: '2026-11-20T12:03:00.000Z' },
    ]);
  });

  it('reads the provider id from an audit after snapshot or activity metadata', () => {
    expect(resendIdFromSnapshot({ resend_id: 'res_123' })).toBe('res_123');
    expect(resendIdFromSnapshot({ after: { resend_id: 'nested' } })).toBeNull();
    expect(resendIdFromSnapshot({ resend_id: '   ' })).toBeNull();
    expect(resendIdFromSnapshot(null)).toBeNull();
  });

  it('queries only this contact and the sends on the page', async () => {
    const tables = {
      crm_email_events: {
        rows: [
          {
            id: 'e1',
            contact_id: 'c1',
            provider_id: 'res_1',
            event_type: 'delivered',
            occurred_at: '2026-11-20T12:01:00.000Z',
          },
          {
            id: 'e2',
            contact_id: 'c1',
            provider_id: 'res_1',
            event_type: 'complained',
            occurred_at: '2026-11-20T12:05:00.000Z',
          },
          {
            id: 'e3',
            contact_id: 'c2',
            provider_id: 'res_1',
            event_type: 'bounced',
            occurred_at: '2026-11-20T12:06:00.000Z',
          },
        ],
      },
    };
    const client = createMockAdminClient(tables);

    const deliveries = await getDirectEmailDeliveries(client, {
      contactId: 'c1',
      providerIds: ['res_1'],
      acceptedAtByProvider: new Map([['res_1', ACCEPTED_AT]]),
    });

    expect(deliveries.get('res_1')).toMatchObject({
      status: 'complained',
      deliveredAt: '2026-11-20T12:01:00.000Z',
      complainedAt: '2026-11-20T12:05:00.000Z',
    });
    // The c2 event must not leak into c1's send.
    expect(deliveries.get('res_1')?.bouncedAt).toBeNull();
  });

  it('returns an accepted-only summary for a send with no rows', async () => {
    const client = createMockAdminClient({ crm_email_events: { rows: [] } });

    const delivery = await getDirectEmailDelivery(client, {
      contactId: 'c1',
      providerId: 'res_missing',
      acceptedAt: ACCEPTED_AT,
    });

    expect(delivery.status).toBe('accepted');
    expect(delivery.events).toEqual([]);
  });

  it('surfaces a delivery-event read failure to the caller', async () => {
    const client = createMockAdminClient({
      crm_email_events: { rows: [], error: { message: 'timeout' } },
    });

    await expect(
      getDirectEmailDelivery(client, {
        contactId: 'c1',
        providerId: 'res_1',
        acceptedAt: ACCEPTED_AT,
      })
    ).rejects.toThrow(/Failed to read direct-email delivery events: timeout/i);
  });
});

describe('delivered event migration', () => {
  it('admits delivered without dropping any existing event type', async () => {
    const sql = await Bun.file(
      resolve(process.cwd(), 'supabase/migrations/20261120130000_crm_email_delivered_events.sql')
    ).text();
    const code = sql.replace(/--[^\n]*/g, '');

    expect(code).toMatch(/drop constraint if exists crm_email_events_event_type_check/i);
    for (const type of [
      'bounced',
      'complained',
      'opened',
      'clicked',
      'delivery_delayed',
      'suppressed',
      'delivered',
    ]) {
      expect(code).toMatch(new RegExp(`'${type}'`, 'i'));
    }
  });
});

describe('Resend webhook subscription', () => {
  it('subscribes the provisioning script to every event the route maps', async () => {
    const [route, script] = await Promise.all([
      Bun.file(resolve(process.cwd(), 'src/app/api/webhooks/resend/route.ts')).text(),
      Bun.file(resolve(process.cwd(), 'scripts/enable-resend-webhook.mjs')).text(),
    ]);

    const mappingStart = route.indexOf('const RESEND_TO_EVENT_TYPE');
    const mapping = route.slice(mappingStart, route.indexOf('};', mappingStart) + 2);
    const mapped = [...mapping.matchAll(/'([^']+)'\s*:/g)].map((match) => match[1]).sort();

    const eventsStart = script.indexOf('const EVENTS');
    const eventsBlock = script.slice(eventsStart, script.indexOf('];', eventsStart) + 2);
    const subscribed = [...eventsBlock.matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();

    expect(subscribed).toEqual(mapped);
    expect(subscribed).toContain('email.delivered');
  });
});
