import { publicEnv } from '@/lib/public-env';

/**
 * PostHog event analytics — the client half.
 *
 * ## What this module is, and what it refuses to be
 *
 * It owns two decisions and nothing else: *when* the SDK initialises and *what*
 * it is allowed to capture. The React binding in
 * `@/components/analytics/PostHogAnalytics` initialises it once; named events
 * are captured by `captureAnalyticsEvent`. Everything that can be reasoned about
 * without a browser lives here, so the rules are unit-tested rather than
 * trusted.
 *
 * **There is no session replay.** The SDK is initialised with recording
 * disabled, and no code path calls `startSessionRecording()`. A toggle that
 * grants replay would be a promise this product does not make; adding replay
 * later needs a real opt-in and route exclusions, not a stored flag.
 *
 * **Do Not Track and Global Privacy Control suppress PostHog only.** They are
 * browser-level instructions and are checked before the SDK loads. They do not
 * suppress Vercel Analytics or Speed Insights: those are separate, aggregate
 * beacons mounted in the root layout, and this module has no control over them.
 * The privacy policy states that split rather than claiming DNT disables
 * everything.
 *
 * **No autocapture and no person profiles for anonymous visitors.** Autocapture
 * ships the text of whatever was clicked, and a label beside an input can
 * describe what someone was writing. The journey events this project actually
 * cares about are captured by name, in `captureAnalyticsEvent`.
 *
 * The SDK is loaded lazily and only when a project token is configured, so
 * local dev, CI and the e2e bundle carry no PostHog code and file no events.
 * That is the same switch shape `NEXT_PUBLIC_SENTRY_DSN` uses in
 * `src/instrumentation-client.ts`, deliberately.
 */

/** PostHog Cloud US. An EU deployment changes this one line to `https://eu.i.posthog.com`. */
const POSTHOG_HOST = 'https://us.i.posthog.com';

/**
 * The browser surfaces this module reads. Narrow structural types rather than
 * `Navigator` so a test can pass an object literal, and so the guard below is
 * exercised by the same code path the browser takes.
 */
interface PrivacySignals {
  /** `navigator.doNotTrack` — `'1'` when set in most browsers. */
  doNotTrack?: string | null;
  /** `navigator.globalPrivacyControl` — a boolean in browsers that implement GPC. */
  globalPrivacyControl?: boolean | null;
}

/**
 * Whether PostHog event analytics may load.
 *
 * DNT has three notorious spellings (`'1'`, `'yes'`, and the
 * `'unspecified'`/`'0'` negatives), so the check is positive — anything that is
 * not clearly "track me" reads as a refusal.
 */
export function analyticsAllowed(signals: PrivacySignals = {}): boolean {
  const dnt = signals.doNotTrack;
  if (dnt === '1' || dnt === 'yes') return false;
  if (signals.globalPrivacyControl === true) return false;
  return true;
}

/** The effective signal in this browser. */
function browserAllowsAnalytics(): boolean {
  if (typeof window === 'undefined') return false;
  return analyticsAllowed({
    doNotTrack: window.navigator.doNotTrack,
    globalPrivacyControl: (window.navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl,
  });
}

/** The SDK, typed from its own module so no local copy of the surface can drift. */
type PostHogClient = typeof import('posthog-js')['default'];

let client: PostHogClient | null = null;
let pending: Promise<PostHogClient | null> | null = null;

/**
 * Load and initialise the SDK. Idempotent: the promise is memoised, so calling
 * this more than once never initialises a second client.
 *
 * Returns `null` — never throws — when there is no token, when DNT/GPC denies
 * analytics, or when the SDK fails to load. Measurement is not a feature the
 * page depends on, so a failure here must not reach the visitor.
 */
export function initAnalytics(): Promise<PostHogClient | null> {
  if (pending) return pending;
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!publicEnv.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return Promise.resolve(null);
  if (!browserAllowsAnalytics()) return Promise.resolve(null);

  pending = loadClient(publicEnv.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN);

  return pending;
}

/**
 * Load the SDK and call `init` once, tolerating a failure to load.
 *
 * The import is `@/lib/posthog-client` rather than `posthog-js` itself: that is
 * the module holding the static SDK import, and going through a dynamic
 * `import()` here is what keeps the SDK in its own chunk instead of the client
 * bundle every page loads. A missing or blocked chunk resolves to `null`, so
 * measurement can never break a page.
 */
async function loadClient(token: string): Promise<PostHogClient | null> {
  try {
    const { posthogSdk: posthog } = await import('@/lib/posthog-client');
    posthog.init(token, {
      api_host: POSTHOG_HOST,
      // Vercel Analytics owns pageviews. PostHog is for named journey events,
      // and leaving its history listener off prevents double-counting.
      capture_pageview: false,
      // Explicit events only. Autocapture ships the text of whatever was
      // clicked, and a label beside an input can describe what someone was
      // writing. The journey events this project actually cares about are
      // captured by name, in `captureAnalyticsEvent`.
      autocapture: false,
      // No person profiles for anonymous visitors: a distinct ID and a
      // session, not a stored person per constituent.
      person_profiles: 'identified_only',
      // Defense in depth: the module also refuses to load the SDK when the
      // browser sends DNT or GPC.
      respect_dnt: true,
      // Session replay is not part of this product. The init-time kill switch
      // stays explicit so a remote project setting cannot turn recording on
      // for this client.
      disable_session_recording: true,
    });
    client = posthog;
    return posthog;
  } catch {
    return null;
  }
}

/**
 * Capture a named journey event. A no-op until the SDK is initialised, so a
 * component can call it unconditionally without knowing whether measurement is
 * configured or allowed.
 */
export function captureAnalyticsEvent(event: string, properties?: Record<string, unknown>): void {
  client?.capture(event, properties);
}
