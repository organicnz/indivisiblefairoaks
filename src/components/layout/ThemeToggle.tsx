'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';
import { useDataPoints } from '@/hooks/useDataPoints';
import { nextThemeMode, THEME_ORDER, type ThemeMode, themeModeLabel } from '@/lib/theme';
import { useThemeMode } from './theme-store';

// Focus ring, matching the header's other controls. Declared per component by
// convention (Header, NavDropdown, CivicCommandPalette each carry their own).
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-secondary';

const MODE_ICON: Record<ThemeMode, typeof Monitor> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

/**
 * One sentence that says what the theme is *and* what a click does.
 *
 * A three-state control cannot use `aria-pressed` (two states) and cannot rely
 * on an icon alone (a moon in a dark header is ambiguous). The accessible name
 * carries the whole state machine, so a screen-reader user learns the current
 * mode and the next one from the same announcement — the same reasoning the
 * header's toggle button follows.
 */
function themeToggleLabel(mode: ThemeMode): string {
  const current = themeModeLabel(mode);
  const following = mode === 'system' ? ' — following your device setting' : '';
  const next = themeModeLabel(nextThemeMode(mode));
  return `Color theme: ${current}${following}. Click to switch to ${next}.`;
}

/**
 * The light/dark/system control in the site header and the navigation drawer.
 *
 * `system` is where every reader starts: the palette follows the operating
 * system and is re-resolved live when that setting changes (the store listens
 * to the media query). Clicking cycles system → light → dark → system, and a
 * pinned choice survives reloads in localStorage.
 *
 * The icon shows the current mode, not the next one, and the accessible name
 * says what a click will do — a control whose glyph and announcement disagree
 * is worse than one with no glyph.
 */
export function ThemeToggle({ variant = 'icon' }: { variant?: 'icon' | 'block' | 'segmented' }) {
  const { dataPoints } = useDataPoints('header');
  const { mode, effective, setMode, cycle } = useThemeMode();
  const Icon = MODE_ICON[mode];
  const label = themeToggleLabel(mode);

  if (variant === 'segmented') {
    return (
      <fieldset className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
        <legend className="sr-only">Color theme</legend>
        {THEME_ORDER.map((m) => {
          const ItemIcon = MODE_ICON[m];
          const isActive = mode === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={isActive}
              onClick={() => setMode(m)}
              data-theme-mode={m}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isActive
                  ? 'bg-amber-400 text-secondary shadow-xs font-extrabold'
                  : 'text-ink-muted-on-dark hover:text-white hover:bg-white/10'
              }`}
              title={`Switch to ${themeModeLabel(m)} theme`}
            >
              <ItemIcon size={14} aria-hidden="true" />
              <DataPoint
                as="span"
                name={`header.theme.mode_${m}`}
                initialData={dataPoints}
                className="capitalize"
              >
                {themeModeLabel(m)}
              </DataPoint>
            </button>
          );
        })}
      </fieldset>
    );
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={cycle}
        data-theme-mode={mode}
        data-theme-effective={effective}
        aria-label={label}
        title={label}
        className={`relative inline-flex items-center justify-center size-11 rounded-lg text-ink-on-dark hover:text-white hover:bg-white/10 transition-colors duration-300 ease-out ${FOCUS_RING}`}
      >
        <Icon size={18} aria-hidden="true" />
        {mode === 'system' && (
          <span
            aria-hidden="true"
            className={`absolute bottom-2 right-2 size-1.5 rounded-full ring-1 ring-secondary ${
              effective === 'dark' ? 'bg-sky-400' : 'bg-amber-400'
            }`}
          />
        )}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={cycle}
        data-theme-mode={mode}
        aria-label={label}
        title={label}
        className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-ink-on-dark hover:text-white transition-colors duration-300 ease-out text-sm font-medium ${FOCUS_RING}`}
      >
        <Icon size={18} aria-hidden="true" />
        <DataPoint as="span" name="header.theme.appearance" initialData={dataPoints}>
          Appearance
        </DataPoint>
        <span className="ml-auto text-xs font-semibold uppercase tracking-wider text-ink-muted-on-dark">
          <DataPoint as="span" name={`header.theme.mode_${mode}`} initialData={dataPoints}>
            {themeModeLabel(mode)}
          </DataPoint>
        </span>
      </button>
      <fieldset className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
        <legend className="sr-only">Color theme modes</legend>
        {THEME_ORDER.map((m) => {
          const ItemIcon = MODE_ICON[m];
          const isSelected = mode === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setMode(m)}
              data-theme-mode={m}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                isSelected
                  ? 'bg-amber-400 text-secondary shadow-xs font-black'
                  : 'text-ink-muted-on-dark hover:text-white hover:bg-white/10'
              }`}
            >
              <ItemIcon size={13} aria-hidden="true" />
              <DataPoint
                as="span"
                name={`header.theme.mode_${m}`}
                initialData={dataPoints}
                className="capitalize"
              >
                {themeModeLabel(m)}
              </DataPoint>
            </button>
          );
        })}
      </fieldset>
    </div>
  );
}
