// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  consumeIceAlertConfirmation,
  type IceAlertStore,
} from '@/lib/ice-alert-store';
import { createMockAdminClient } from './supabase-mock';

const OLD_TOKEN = '22222222-2222-4222-8222-222222222222';
const FUTURE = '2030-01-01T00:00:00.000Z';
const PAST = '2020-01-01T00:00:00.000Z';

function subscriber(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'robin@example.com',
    email_normalized: 'robin@example.com',
    state_code: 'CA',
    city: 'Oakland',
    email_opt_in: false,
    push_opt_in: false,
    push_subscription: null,
    confirm_token: OLD_TOKEN,
    confirm_token_expires_at: FUTURE,
    unsubscribe_token: '33333333-3333-4333-8333-333333333333',
    confirmed_at: null,
    confirmation_sent_at: null,
    last_notified_at: null,
    last_surge_key: null,
    unsubscribed_at: null,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

function storeWith(row: Record<string, unknown>) {
  return createMockAdminClient({
    ice_alert_subscribers: { rows: [row] },
  });
}

describe('consumeIceAlertConfirmation', () => {
  it('rotates the token and clears its expiry only when the token matches', async () => {
    const row = subscriber();
    const store = storeWith(row);

    const consumed = await consumeIceAlertConfirmation(
      store as unknown as IceAlertStore,
      String(row.id),
      OLD_TOKEN,
      { email_opt_in: true, confirmed_at: '2026-11-16T00:00:00.000Z' }
    );

    expect(consumed).toMatchObject({
      id: row.id,
      email_opt_in: true,
      confirmed_at: '2026-11-16T00:00:00.000Z',
    });
    expect(row.confirm_token).not.toBe(OLD_TOKEN);
    expect(row.confirm_token_expires_at).toBeNull();
  });

  it('refuses a replay with the consumed token', async () => {
    const row = subscriber();
    const store = storeWith(row);

    await consumeIceAlertConfirmation(
      store as unknown as IceAlertStore,
      String(row.id),
      OLD_TOKEN,
      { email_opt_in: true }
    );
    const replay = await consumeIceAlertConfirmation(
      store as unknown as IceAlertStore,
      String(row.id),
      OLD_TOKEN,
      { email_opt_in: true }
    );

    expect(replay).toBeNull();
  });

  it('refuses an expired token even if the caller still has it', async () => {
    const row = subscriber({ confirm_token_expires_at: PAST });
    const store = storeWith(row);

    const consumed = await consumeIceAlertConfirmation(
      store as unknown as IceAlertStore,
      String(row.id),
      OLD_TOKEN,
      { email_opt_in: true }
    );

    expect(consumed).toBeNull();
    expect(row.confirm_token).toBe(OLD_TOKEN);
  });
});
