// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_CONSENT_KEY,
  isReplayAllowedPath,
  readAnalyticsConsent,
  resolveAnalyticsConsent,
  writeAnalyticsConsent,
} from '@/lib/posthog';

/**
 * The two decisions that are worth pinning about session replay.
 *
 * Neither is visible from the page: a replay that records the wrong route, or
 * that keeps recording after a visitor said no, looks exactly like a working
 * integration. So the rules are pure functions and this is the gate on them,
 * rather than a comment on `posthog.init`.
 *
 * Nothing here touches the SDK. `initAnalytics` is a lazy import guarded on a
 * token and on consent, and its failure modes are "returns null" — there is no
 * branch in it that is worth a mock, and a mocked SDK would only prove the mock.
 */

/** A `Storage` stand-in. A plain object literal, so no jsdom is needed. */
function memoryStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    has: (key: string) => values.has(key),
  };
}

describe('analytics consent storage', () => {
  it('reads a value it did not write as undecided', () => {
    // An older release, a hand-edited key, another site sharing the origin. A
    // bad preference has to reset, never read as permission.
    expect(readAnalyticsConsent(memoryStorage({ [ANALYTICS_CONSENT_KEY]: 'yes' }))).toBe(
      'undecided'
    );
    expect(readAnalyticsConsent(memoryStorage({ [ANALYTICS_CONSENT_KEY]: 'true' }))).toBe(
      'undecided'
    );
    expect(readAnalyticsConsent(null)).toBe('undecided');
  });

  it('round-trips both decisions', () => {
    const storage = memoryStorage();
    writeAnalyticsConsent(storage, 'granted');
    expect(readAnalyticsConsent(storage)).toBe('granted');
    writeAnalyticsConsent(storage, 'denied');
    expect(readAnalyticsConsent(storage)).toBe('denied');
  });

  it('removes the key when the decision is withdrawn to undecided', () => {
    // A tombstone would read as a pin after the visitor has deliberately
    // withdrawn it, which is the same bug the theme store avoids.
    const storage = memoryStorage({ [ANALYTICS_CONSENT_KEY]: 'granted' });
    writeAnalyticsConsent(storage, 'undecided');
    expect(storage.has(ANALYTICS_CONSENT_KEY)).toBe(false);
  });

  it('survives a storage that throws', () => {
    // Safari private browsing throws on write, and a stubbed Storage can throw
    // on read. Neither may take the page down, and neither may become consent.
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(readAnalyticsConsent(throwing)).toBe('undecided');
    expect(() => writeAnalyticsConsent(throwing, 'granted')).not.toThrow();
  });
});

describe('analytics consent resolution', () => {
  it('honours Do Not Track over a stored grant', () => {
    // The browser-level instruction wins: it applies to every site, and it is
    // the one signal a visitor can give without trusting this page.
    const storage = memoryStorage({ [ANALYTICS_CONSENT_KEY]: 'granted' });
    expect(resolveAnalyticsConsent(storage, { doNotTrack: '1' })).toBe('denied');
    expect(resolveAnalyticsConsent(storage, { doNotTrack: 'yes' })).toBe('denied');
  });

  it('honours Global Privacy Control over a stored grant', () => {
    const storage = memoryStorage({ [ANALYTICS_CONSENT_KEY]: 'granted' });
    expect(resolveAnalyticsConsent(storage, { globalPrivacyControl: true })).toBe('denied');
  });

  it('treats an unspecified Do Not Track value as no instruction', () => {
    // `'unspecified'`, `'0'` and `null` are what browsers send when the signal
    // is off — reading any of them as a refusal would silently disable
    // analytics for most visitors.
    const storage = memoryStorage({ [ANALYTICS_CONSENT_KEY]: 'granted' });
    for (const value of ['0', 'unspecified', '', null, undefined]) {
      expect(resolveAnalyticsConsent(storage, { doNotTrack: value })).toBe('granted');
    }
  });

  it('reports undecided when nothing has been stored and nothing is set', () => {
    expect(resolveAnalyticsConsent(memoryStorage(), {})).toBe('undecided');
  });
});

describe('replay route allowlist', () => {
  it('refuses the surfaces that render somebody’s own data or credentials', () => {
    for (const pathname of [
      '/admin',
      '/admin/crm',
      '/admin/crm/12345',
      '/account',
      '/account/settings',
      '/auth/callback',
      '/auth/mfa',
      '/login',
      '/success',
    ]) {
      expect(isReplayAllowedPath(pathname), `${pathname} must never be recorded`).toBe(false);
    }
  });

  it('allows the public pages, including ones that merely start with a blocked word', () => {
    // Segment matching, not `startsWith`: `/administration` is a different page
    // from `/admin`, and a prefix check would silently disable recording on it.
    for (const pathname of [
      '/',
      '/about',
      '/events',
      '/administration',
      '/login-help',
      '/accountability',
      '/products/choir-songbook',
    ]) {
      expect(isReplayAllowedPath(pathname), `${pathname} should be recordable`).toBe(true);
    }
  });

  it('refuses to record when the route is not known yet', () => {
    // The first render before the router resolves a pathname, and any non-path
    // input. Recording must default to off, never to on.
    expect(isReplayAllowedPath(null)).toBe(false);
    expect(isReplayAllowedPath(undefined)).toBe(false);
    expect(isReplayAllowedPath('')).toBe(false);
    expect(isReplayAllowedPath('https://evil.example/admin')).toBe(false);
  });
});
