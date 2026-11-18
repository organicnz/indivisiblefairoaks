// @vitest-environment jsdom-same-realm
import { beforeEach, describe, expect, it } from 'vitest';
import {
  diffNewAlertIds,
  RAPID_SEEN_KEY,
  readSeenAlertIds,
  writeSeenAlertIds,
} from '@/components/ice-alerts/rapid-new';

describe('rapid new alert diff', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns only IDs this browser has not recorded', () => {
    expect([...diffNewAlertIds(new Set(['a', 'b', 'c']), new Set(['a', 'c']))]).toEqual([
      'b',
    ]);
    expect(diffNewAlertIds(new Set(['a']), new Set(['a'])).size).toBe(0);
  });

  it('round-trips seen IDs and caps the stored list', () => {
    writeSeenAlertIds(['a', 'b', 'c']);
    expect([...(readSeenAlertIds() ?? [])]).toEqual(['a', 'b', 'c']);

    const many = Array.from({ length: 600 }, (_, index) => `id-${index}`);
    writeSeenAlertIds(many);
    expect(readSeenAlertIds()?.size).toBe(500);
  });

  it('discards malformed storage instead of treating it as a baseline', () => {
    window.localStorage.setItem(RAPID_SEEN_KEY, JSON.stringify({ not: 'an array' }));
    expect(readSeenAlertIds()).toBeNull();
    expect(window.localStorage.getItem(RAPID_SEEN_KEY)).toBeNull();
  });
});
