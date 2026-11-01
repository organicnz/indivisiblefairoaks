import { env } from '@/lib/env';

/**
 * PostHog session replay — the client half.
 *
 * ## What this module is, and what it refuses to be
 *
 * It owns three decisions and nothing else: *when* the SDK initialises, *what*
 * it is allowed to record, and *which routes* it is allowed to record on. The
 * React binding in `@/components/analytics/PostHogAnalytics` does the mounting
 * and the per-navigation calls; everything that can be reasoned about without a
 * browser lives here, so the rules are unit-tested rather than trusted.
 *
 * **Session replay on this site is masked by default.** A constituent-facing
 * organising site collects names, email addresses and what someone wrote to
 * their chapter. So inputs are always masked (`maskAllInputs`), any element
 * marked `data-ph-mask` is masked, and recorded network request URLs have their
 * query strings stripped — a magic-link callback carries a `code` in the query
 * string and a replay must never be the place it is stored.
 *
 * **Recording needs consent; analytics does not.** The rest of the site already
 * ships Vercel Analytics unconditionally, so pageview capture follows the same
 * posture — with one addition this site did not have before: Do Not Track and
 * Global Privacy Control are honoured, and either one disables everything. A
 * *recording*, though, is a full reproduction of somebody's screen, so it stays
 * off until `posthog.startSessionRecording()` is reached through an explicit
 * `granted` decision. Nothing in the app grants it yet; a consent banner, or a
 * privacy toggle, calls `setAnalyticsConsent('granted')` and recording begins
 * on the next navigation.
 *
 * **Some surfaces are never recorded at all.** `/admin` and `/account` render
 * constituent data and an organiser's own profile, `/login` and `/auth` handle
 * credentials, and `/success` confirms an order. Replays of those pages are the
 * exact thing the masking above exists to prevent, so they are excluded outright
 * rather than masked and hoped for — see `isReplayAllowedPath`.
 *
 * The SDK is loaded lazily and only when a project token is configured, so
 * local dev, CI and the e2e bundle carry no PostHog code and file no events.
 * That is the same switch shape `NEXT_PUBLIC_SENTRY_DSN` uses in
 * `src/instrumentation-client.ts`, deliberately.
 */

/** PostHog Cloud US. An EU deployment changes this one line to `https://eu.i.posthog.com`. */
export const POSTHOG_HOST = 'https://us.i.posthog.com';

/** Where a visitor's decision is kept. Namespaced: localStorage is shared. */
export const ANALYTICS_CONSENT_KEY = 'indivisible:analytics-consent';

/**
 * What a visitor has said about recording. `undecided` is the initial state —
 * nobody has been asked, which is not the same as "yes" and is not the same as
 * "no".
 */
export const ANALYTICS_CONSENT_VALUES = ['granted', 'denied', 'undecided'] as const;

export type AnalyticsConsent = (typeof ANALYTICS_CONSENT_VALUES)[number];

/** The two decisions a visitor can actually make — `undecided` is the absence of one. */
export type AnalyticsConsentDecision = Exclude<AnalyticsConsent, 'undecided'>;

/**
 * Route prefixes that are never recorded — see the module docblock. Matched on
 * whole path segments, so `/administration` is not `/admin`.
 */
export const REPLAY_BLOCKED_PREFIXES = [
  '/admin',
  '/account',
  '/auth',
  '/login',
  '/success',
] as const;

/**
 * The browser surfaces this module reads. Narrow structural types rather than
 * `Storage` and `Navigator` so a test can pass an object literal, and so the
 * guards below are exercised by the same code path the browser takes.
 */
type ConsentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

interface PrivacySignals {
  /** `navigator.doNotTrack` — `'1'` when set in most browsers. */
  doNotTrack?: string | null;
  /** `navigator.globalPrivacyControl` — a boolean in browsers that implement GPC. */
  globalPrivacyControl?: boolean | null;
}

/**
 * The stored decision, or `undecided`.
 *
 * A value this module did not write — an older release, a hand-edited key, a
 * quota error in Safari private browsing — reads as `undecided`. A bad
 * preference is a preference that resets, not a page that fails.
 */
export function readAnalyticsConsent(
  storage: Pick<Storage, 'getItem'> | null | undefined
): AnalyticsConsent {
  try {
    const raw = storage?.getItem(ANALYTICS_CONSENT_KEY);
    return raw === 'granted' || raw === 'denied' ? raw : 'undecided';
  } catch {
    return 'undecided';
  }
}

/** Persist a decision. `undecided` removes the key, so "never asked" has no tombstone. */
export function writeAnalyticsConsent(
  storage: ConsentStorage | null | undefined,
  decision: AnalyticsConsent
): void {
  try {
    if (decision === 'undecided') storage?.removeItem(ANALYTICS_CONSENT_KEY);
    else storage?.setItem(ANALYTICS_CONSENT_KEY, decision);
  } catch {
    // An unstorable decision still applies to this page; it just does not
    // survive a reload. Losing it is the honest outcome, and it never turns
    // into an accidental "granted".
  }
}

/**
 * Resolve the effective consent.
 *
 * Do Not Track and Global Privacy Control win over a stored decision, in that
 * order of authority: they are a browser-level instruction that applies to every
 * site, and honouring them is the one thing a visitor can do without trusting
 * this page. DNT has three notorious spellings (`'1'`, `'yes'`, and the
 * `'unspecified'`/`'0'` negatives), so the check is positive — anything that is
 * not clearly "track me" reads as a refusal.
 */
export function resolveAnalyticsConsent(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  signals: PrivacySignals = {}
): AnalyticsConsent {
  const dnt = signals.doNotTrack;
  if (dnt === '1' || dnt === 'yes') return 'denied';
  if (signals.globalPrivacyControl === true) return 'denied';
  return readAnalyticsConsent(storage);
}

/** Whether session recording may run on this route. `null` = not known yet. */
export function isReplayAllowedPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (!pathname.startsWith('/')) return false;
  return !REPLAY_BLOCKED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** The SDK, typed from its own module so no local copy of the surface can drift. */
type PostHogClient = typeof import('posthog-js')['default'];

let client: PostHogClient | null = null;
let pending: Promise<PostHogClient | null> | null = null;

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The effective consent in this browser, DNT/GPC included. */
export function getAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === 'undefined') return 'undecided';
  return resolveAnalyticsConsent(browserStorage(), {
    doNotTrack: window.navigator.doNotTrack,
    globalPrivacyControl: (window.navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl,
  });
}

/**
 * Load and initialise the SDK. Idempotent, and safe to call on every navigation:
 * the promise is memoised so a route change never initialises a second client.
 *
 * Returns `null` — never throws — when there is no token, when consent is
 * `denied`, or when the SDK fails to load. Measurement is not a feature the page
 * depends on, so a failure here must not reach the visitor.
 */
export function initAnalytics(): Promise<PostHogClient | null> {
  if (pending) return pending;
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return Promise.resolve(null);
  if (getAnalyticsConsent() === 'denied') return Promise.resolve(null);

  pending = loadClient(env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN);

  return pending;
}

/**
 * Load the SDK and call `init` once, tolerating a failure to load.
 *
 * The import is `@/lib/posthog-client` rather than `posthog-js` itself: that is
 * the module holding the static SDK import, and going through a dynamic
 * `import()` here is what keeps the replay recorder in its own chunk instead of
 * the client bundle every page loads. A missing or blocked chunk resolves to
 * `null`, so measurement can never break a page.
 */
async function loadClient(token: string): Promise<PostHogClient | null> {
  try {
    const { posthogSdk: posthog } = await import('@/lib/posthog-client');
    posthog.init(token, {
      api_host: POSTHOG_HOST,
      // Pageviews are captured per navigation by the React binding, which
      // knows the resolved pathname. The SDK's own history listener would
      // double-count them.
      capture_pageview: false,
      // Explicit events only. Autocapture ships the text of whatever was
      // clicked, and a masked input is still a label reading "Your message
      // to the chapter" beside it. The journey events this project actually
      // cares about are captured by name, in `captureAnalyticsEvent`.
      autocapture: false,
      // No person profiles for anonymous visitors: a distinct ID and a
      // session, not a stored person per constituent.
      person_profiles: 'identified_only',
      respect_dnt: true,
      // Recording is off until a visitor grants it. This is the whole of the
      // consent-aware part of the integration.
      disable_session_recording: true,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '[data-ph-mask]',
        // `/success`, `/account` … are excluded by route (see
        // `isReplayAllowedPath`), and this covers anything inside an allowed
        // page that happens to render sensitive content.
        blockSelector: '[data-ph-block], .ph-no-capture',
        // Canvas capture is not configurable from here on posthog-js 1.444+:
        // `recordCanvas` now lives in the project's remote config only, so the
        // local option is gone from `SessionRecordingOptions` and setting it is
        // a type error. It defaults off; if the project ever enables it, the
        // screens that render a canvas need a `[data-ph-block]` wrapper.
        collectFonts: false,
        maskCapturedNetworkRequestFn: (request) => {
          // Query strings are where this site puts a magic-link `code` and a
          // search term. The redaction runs in the browser, so neither leaves
          // the visitor's device.
          if (request.name) request.name = request.name.split('?')[0];
          return request;
        },
      },
    });
    client = posthog;
    return posthog;
  } catch {
    return null;
  }
}

/**
 * Turn recording on or off for the current route and consent.
 *
 * Called on every navigation by the React binding. `startSessionRecording()`
 * starts a recording that was never running; `set_config` clears the persisted
 * "disabled" flag first, because a recorder disabled at init stays disabled for
 * the rest of the page load otherwise.
 */
export function syncAnalyticsReplay(pathname: string | null): void {
  if (!client) return;
  if (getAnalyticsConsent() === 'granted' && isReplayAllowedPath(pathname)) {
    client.set_config({ disable_session_recording: false });
    client.startSessionRecording();
    return;
  }
  client.stopSessionRecording();
}

/**
 * Record a visitor's decision, and apply it to the client that is already
 * running.
 *
 * `denied` stops recording and opts the browser out of capturing entirely, so a
 * visitor who changes their mind mid-session is not left sending events under a
 * consent they have withdrawn.
 */
export async function setAnalyticsConsent(decision: AnalyticsConsentDecision): Promise<void> {
  if (typeof window === 'undefined') return;
  writeAnalyticsConsent(browserStorage(), decision);

  if (decision === 'denied') {
    client?.stopSessionRecording();
    client?.opt_out_capturing();
    return;
  }

  const active = await initAnalytics();
  if (!active) return;
  active.opt_in_capturing();
  syncAnalyticsReplay(window.location.pathname);
}

/**
 * Capture a named journey event. A no-op until the SDK is initialised, so a
 * component can call it unconditionally without knowing whether measurement is
 * configured or consented to.
 */
export function captureAnalyticsEvent(event: string, properties?: Record<string, unknown>): void {
  client?.capture(event, properties);
}
