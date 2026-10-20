/**
 * Theme mode — the pure half.
 *
 * The site renders a light and a dark palette, and the reader's operating
 * system setting decides which one they see by default. `system` is therefore
 * the initial state, not a fallback: an explicit `light` or `dark` is a pin
 * that survives reloads and overrides the OS setting until it is withdrawn.
 *
 * This module owns the three things that state consists of — where it is
 * persisted, how an operating-system preference resolves to a palette, and
 * which attribute carries the answer to the stylesheet — and nothing else.
 * Like `visual-edit-mode.ts` it is deliberately free of React so the client
 * store is testable without a component harness, and so the no-flash bootstrap
 * script and the store cannot disagree about what "system" means.
 *
 * Two design constraints shaped it.
 *
 * **The theme must be known before the first paint.** A client-side store
 * applies its answer *after* hydration, which would show every reader a
 * wrong-palette flash on every navigation. `themeBootstrapScript()` emits a
 * script small enough to run inline and synchronously in `<head>`, so the
 * attribute is set before the browser paints anything. The client store then
 * reads the same storage and keeps the attribute current; the script's
 * semantics are the resolution below, and `theme-bootstrap` tests keep the two
 * honest.
 *
 * **The stored value is validated, not trusted.** A value from an older
 * release, a hand-edited localStorage or another site sharing the key reads as
 * `system` rather than throwing: a bad preference is a preference that resets,
 * not a page that fails to render.
 */

/** Where the per-browser preference lives. Namespaced: localStorage is shared. */
export const THEME_STORAGE_KEY = 'indivisible:theme-mode';

/**
 * The attribute on `<html>` that selects the palette.
 *
 * An attribute rather than a class because the stylesheet keys both a token
 * override and a variant on it, and because an empty class list can never
 * accidentally inherit "the theme" from somewhere else in the cascade.
 */
export const THEME_ATTR = 'data-theme';

export const THEME_MODES = ['system', 'light', 'dark'] as const;

/** What the reader chose, or `system` to follow the operating system. */
export type ThemeMode = (typeof THEME_MODES)[number];

/** What the stylesheet is currently painting. */
export type EffectiveTheme = 'light' | 'dark';

/** The order a cycle visits. System first: it is the state most readers are in. */
export const THEME_ORDER: readonly ThemeMode[] = ['system', 'light', 'dark'];

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value);
}

/**
 * Read the persisted preference. Any storage that throws — Safari private
 * browsing, a quota error, a Storage object stubbed by a test — reads as
 * `system` rather than taking the page down.
 */
export function readThemeMode(storage: Pick<Storage, 'getItem'> | null | undefined): ThemeMode {
  try {
    const raw = storage?.getItem(THEME_STORAGE_KEY);
    return isThemeMode(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Write the persisted preference. `system` removes the key entirely, so
 * "never expressed a preference" and "follow the OS again" are the same state
 * in storage — anything else would leave a tombstone that reads as a pin after
 * the reader has deliberately withdrawn theirs.
 */
export function writeThemeMode(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null | undefined,
  mode: ThemeMode
): void {
  try {
    if (mode === 'system') storage?.removeItem(THEME_STORAGE_KEY);
    else storage?.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // A preference that cannot be stored is a preference that resets on
    // reload. The theme still applies for this navigation, which is the part
    // the reader sees.
  }
}

/**
 * The palette a mode paints, given whether the OS asks for dark.
 *
 * `system` is the only mode that consults the preference; `light` and `dark`
 * are pins and ignore it. One function so the toggle, the store and the
 * bootstrap script resolve by the same rule.
 */
export function resolveEffectiveTheme(mode: ThemeMode, prefersDark: boolean): EffectiveTheme {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return prefersDark ? 'dark' : 'light';
}

/** The mode a cycle from `mode` lands on. */
export function nextThemeMode(mode: ThemeMode): ThemeMode {
  const index = THEME_ORDER.indexOf(mode);
  return THEME_ORDER[(index + 1) % THEME_ORDER.length];
}

/** The previous mode when cycling backwards. */
export function prevThemeMode(mode: ThemeMode): ThemeMode {
  const index = THEME_ORDER.indexOf(mode);
  return THEME_ORDER[(index - 1 + THEME_ORDER.length) % THEME_ORDER.length];
}

/** A human-readable name for the current choice, used by the toggle's label. */
export function themeModeLabel(mode: ThemeMode): string {
  switch (mode) {
    case 'light':
      return 'Light';
    case 'dark':
      return 'Dark';
    default:
      return 'System';
  }
}

/** Rich human-readable descriptive status for announcements and tooltips. */
export function themeModeDescription(mode: ThemeMode, effective: EffectiveTheme): string {
  if (mode === 'system') {
    return `System (Following device: ${effective === 'dark' ? 'Dark' : 'Light'})`;
  }
  return `${themeModeLabel(mode)} (Pinned)`;
}

/**
 * Set the palette attribute on a document root.
 *
 * Takes the narrowest document shape it needs so the pure tests can pass a
 * stub, and so the client store never has to know which document it is in.
 */
export function applyThemeAttribute(
  documentElement: {
    setAttribute: (name: string, value: string) => void;
    style?: { colorScheme?: string };
    classList?: {
      toggle?: (token: string, force?: boolean) => boolean;
      add?: (token: string) => void;
      remove?: (token: string) => void;
    };
  },
  effective: EffectiveTheme,
  mode?: ThemeMode
): void {
  documentElement.setAttribute(THEME_ATTR, effective);
  if (mode) {
    documentElement.setAttribute('data-theme-mode', mode);
  }
  if (documentElement.style) {
    documentElement.style.colorScheme = effective;
  }
  if (documentElement.classList?.toggle) {
    documentElement.classList.toggle('dark', effective === 'dark');
  }
  if (typeof document !== 'undefined') {
    const metas = document.querySelectorAll?.('meta[name="theme-color"]');
    const color = effective === 'dark' ? '#16305c' : '#eef4ff';
    if (metas && metas.length > 0) {
      metas.forEach((meta) => {
        meta.setAttribute('content', color);
      });
    }
  }
}

/**
 * The synchronous, no-flash bootstrap script.
 *
 * It runs before first paint, which is the only moment the palette can be
 * chosen without the reader seeing the wrong one. It is plain source on
 * purpose — an inline `<script>` cannot import this module — but every branch
 * is the resolution `resolveEffectiveTheme` performs: a `dark` pin, a `light`
 * pin, and everything else (absent, `system`, or a value this release no
 * longer understands) deferred to the OS.
 *
 * The try/catch is load-bearing rather than defensive noise: access to
 * `localStorage` or `matchMedia` throws in a handful of privacy modes, and the
 * correct recovery there is the light palette, not an unstyled document.
 */
export function themeBootstrapScript(): string {
  return [
    '(function(){try{',
    `var m=localStorage.getItem('${THEME_STORAGE_KEY}');`,
    "var d=m==='dark'||(m!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);",
    "var c=d?'dark':'light';",
    `document.documentElement.setAttribute('${THEME_ATTR}',c);`,
    "document.documentElement.setAttribute('data-theme-mode',m||'system');",
    'document.documentElement.style.colorScheme=c;',
    "document.documentElement.classList.toggle('dark',d);",
    'var tc=document.querySelectorAll(\'meta[name="theme-color"]\');',
    "for(var i=0;i<tc.length;i++)tc[i].setAttribute('content',d?'#16305c':'#eef4ff');",
    '}catch(e){',
    `document.documentElement.setAttribute('${THEME_ATTR}','light');`,
    "document.documentElement.setAttribute('data-theme-mode','system');",
    "document.documentElement.style.colorScheme='light';",
    "document.documentElement.classList.remove('dark');",
    '}})();',
  ].join('');
}

/**
 * Tactile micro-haptic synthesized via pure Web Audio API.
 *
 * Produces a soft, physical click feel tailored to the destination mode:
 * - light: ascending bright micro-click (850Hz -> 1200Hz)
 * - dark: descending soft micro-click (950Hz -> 650Hz)
 * - system: dual micro-pulse (800Hz + 1050Hz)
 *
 * Completely silent if:
 * - running on server
 * - `prefers-reduced-motion` is active
 * - AudioContext is not supported or suspended by browser policy
 */
export function playThemeHaptic(
  mode: ThemeMode,
  _effective?: EffectiveTheme,
  coords?: { x?: number; y?: number }
): void {
  if (typeof window === 'undefined') return;
  try {
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    // Physical micro-vibration on supporting mobile hardware
    if (
      typeof navigator !== 'undefined' &&
      'vibrate' in navigator &&
      typeof navigator.vibrate === 'function'
    ) {
      try {
        if (mode === 'system') {
          navigator.vibrate([8, 25, 8]);
        } else if (mode === 'light') {
          navigator.vibrate(10);
        } else {
          navigator.vibrate(15);
        }
      } catch {
        // Suppress device-level vibration restriction
      }
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const oscOvertone = typeof ctx.createOscillator === 'function' ? ctx.createOscillator() : null;
    const gain = ctx.createGain();
    const filter = typeof ctx.createBiquadFilter === 'function' ? ctx.createBiquadFilter() : null;

    osc.type = 'sine';
    if (oscOvertone) oscOvertone.type = 'sine';

    if (mode === 'light') {
      // Ascending crystal glass chime (fundamental: 850Hz -> 1320Hz, harmonic overtone: 1275Hz -> 1980Hz)
      osc.frequency.setValueAtTime(850, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.035);
      if (oscOvertone) {
        oscOvertone.frequency.setValueAtTime(1275, now);
        oscOvertone.frequency.exponentialRampToValueAtTime(1980, now + 0.035);
      }
    } else if (mode === 'dark') {
      // Descending obsidian switch detent (fundamental: 950Hz -> 650Hz, sub-harmonic overtone: 475Hz -> 325Hz)
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.exponentialRampToValueAtTime(650, now + 0.038);
      if (oscOvertone) {
        oscOvertone.frequency.setValueAtTime(475, now);
        oscOvertone.frequency.exponentialRampToValueAtTime(325, now + 0.038);
      }
    } else {
      // System quantum harmonic duality chord (fundamental: 800Hz -> 1100Hz, overtone: 1064Hz -> 1463Hz)
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.042);
      if (oscOvertone) {
        oscOvertone.frequency.setValueAtTime(1064, now);
        oscOvertone.frequency.exponentialRampToValueAtTime(1463, now + 0.042);
      }
    }

    // Physical acoustic damping lowpass filter (~2400Hz cutoff) to eliminate digital clipping
    if (filter) {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, now);
      filter.Q.setValueAtTime(1.2, now);
    }

    // Whisper-quiet gain envelope (0.025 max) with smooth decay to zero
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.025, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    // Node graph routing: osc + oscOvertone -> gain -> filter -> panner -> destination
    osc.connect(gain);
    if (oscOvertone) {
      oscOvertone.connect(gain);
    }

    let audioSource: AudioNode = gain;
    if (filter) {
      gain.connect(filter);
      audioSource = filter;
    }

    // Spatial acoustic panning towards interaction coordinates
    if (typeof ctx.createStereoPanner === 'function' && typeof coords?.x === 'number') {
      const panner = ctx.createStereoPanner();
      const pan = Math.max(
        -0.85,
        Math.min(0.85, (coords.x / Math.max(1, window.innerWidth)) * 2 - 1)
      );
      panner.pan.setValueAtTime(pan, now);
      audioSource.connect(panner);
      panner.connect(ctx.destination);
    } else {
      audioSource.connect(ctx.destination);
    }

    osc.start(now);
    osc.stop(now + 0.045);
    if (oscOvertone) {
      oscOvertone.start(now);
      oscOvertone.stop(now + 0.045);
    }

    osc.onended = () => {
      ctx.close().catch(() => {});
    };
  } catch {
    // Graceful degradation when audio is restricted or unsupported
  }
}
