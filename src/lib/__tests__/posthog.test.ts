// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { analyticsAllowed } from '@/lib/posthog';

/**
 * DNT/GPC are the only runtime privacy controls on PostHog.
 *
 * They are pure functions because the failure is invisible from the page: an
 * analytics client that loads when the browser said no looks exactly like one
 * that works. Nothing here touches the SDK; `initAnalytics` is a lazy import
 * guarded on the token and this check, and its failure modes are "returns
 * null".
 */
describe('PostHog analytics privacy signals', () => {
  it('honours Do Not Track', () => {
    expect(analyticsAllowed({ doNotTrack: '1' })).toBe(false);
    expect(analyticsAllowed({ doNotTrack: 'yes' })).toBe(false);
  });

  it('honours Global Privacy Control', () => {
    expect(analyticsAllowed({ globalPrivacyControl: true })).toBe(false);
  });

  it('treats an unspecified Do Not Track value as no instruction', () => {
    // `'unspecified'`, `'0'` and `null` are what browsers send when the signal
    // is off — reading any of them as a refusal would silently disable
    // analytics for most visitors.
    for (const value of ['0', 'unspecified', '', null, undefined]) {
      expect(analyticsAllowed({ doNotTrack: value })).toBe(true);
    }
  });

  it('allows analytics when neither signal is set', () => {
    expect(analyticsAllowed()).toBe(true);
    expect(analyticsAllowed({ doNotTrack: null, globalPrivacyControl: false })).toBe(true);
  });
});
