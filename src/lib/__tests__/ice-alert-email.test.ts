// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildIceAlertConfirmationEmail,
  buildIceAlertSurgeEmail,
} from '@/lib/ice-alert-email';

const SITE = 'https://site.test';
const CONFIRM = 'confirm-token-11111111';
const UNSUBSCRIBE = 'unsubscribe-token-22222222';

const SURGE = {
  key: 'city:CA:oakland:202611161700',
  scope: 'city' as const,
  severity: 'watch' as const,
  label: '2 community reports in Oakland, CA within 90 minutes.',
  shortLabel: 'Oakland, CA',
  stateCode: 'CA',
  city: 'Oakland',
  count: 2,
  windowMinutes: 90,
  latestAt: '2026-11-16T16:55:00.000Z',
  alertIds: ['alert-1'],
};

describe('ICE alert email capabilities', () => {
  it('uses the confirmation token for confirm and the separate token for unsubscribe', () => {
    const email = buildIceAlertConfirmationEmail({
      email: 'robin@example.com',
      token: CONFIRM,
      unsubscribeToken: UNSUBSCRIBE,
      stateCode: 'CA',
      city: 'Oakland',
      siteUrl: SITE,
    });

    expect(email.html).toContain(
      `${SITE}/api/ice-rapid/confirm?token=${CONFIRM}`
    );
    expect(email.text).toContain(
      `Unsubscribe: ${SITE}/api/ice-rapid/unsubscribe?token=${UNSUBSCRIBE}`
    );
    expect(email.html).not.toContain(
      `/api/ice-rapid/unsubscribe?token=${CONFIRM}`
    );
    expect(email.headers['List-Unsubscribe']).toContain(
      `/api/ice-rapid/unsubscribe?token=${UNSUBSCRIBE}`
    );
  });

  it('never puts a confirmation token in a surge alert', () => {
    const email = buildIceAlertSurgeEmail({
      email: 'robin@example.com',
      unsubscribeToken: UNSUBSCRIBE,
      stateCode: 'CA',
      city: 'Oakland',
      siteUrl: SITE,
      surges: [SURGE],
    });

    expect(email.html).toContain(
      `/api/ice-rapid/unsubscribe?token=${UNSUBSCRIBE}`
    );
    expect(email.html).not.toContain('/api/ice-rapid/confirm');
    expect(email.text).not.toContain('/api/ice-rapid/confirm');
  });
});
