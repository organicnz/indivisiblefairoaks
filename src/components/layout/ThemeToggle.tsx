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
      <fieldset className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
        <legend className="sr-only">
          <DataPoint as="span" name="header.theme.legend" initialData={dataPoints}>
            Color theme
          </DataPoint>
        </legend>
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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ease-out active:scale-95 cursor-pointer ${
                isActive
                  ? 'bg-amber-400 text-secondary shadow-raised font-extrabold ring-1 ring-amber-300/50'
                  : 'text-ink-muted-on-dark hover:text-white hover:bg-white/10'
              }`}
              title={`Switch to ${themeModeLabel(m)} theme`}
            >
              <ItemIcon
                size={14}
                aria-hidden="true"
                className="transition-transform duration-300 group-hover:scale-110"
              />
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
        className={`group relative inline-flex items-center justify-center size-11 rounded-lg text-ink-on-dark hover:text-white hover:bg-white/10 transition-all duration-300 ease-out active:scale-95 cursor-pointer ${FOCUS_RING}`}
      >
        <span className="relative flex items-center justify-center transition-transform duration-300 ease-out group-hover:rotate-12 group-active:scale-90">
          <Icon size={18} aria-hidden="true" className="transition-all duration-300 ease-out" />
        </span>
        {mode === 'system' && (
          <span
            aria-hidden="true"
            className="absolute bottom-2 right-2 flex size-2 items-center justify-center pointer-events-none"
          >
            <span
              className={`relative inline-flex size-1.5 rounded-full ring-1 ring-secondary shadow-xs transition-colors duration-300 ${
                effective === 'dark' ? 'bg-sky-400' : 'bg-amber-400'
              }`}
            />
          </span>
        )}
        {/* Sensory luxury micro-tooltip on pointer devices */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-9 right-0 sm:left-1/2 sm:-translate-x-1/2 whitespace-nowrap rounded-lg bg-secondary/95 dark:bg-slate-800/95 backdrop-blur-md border border-white/10 px-2 py-0.5 text-[11px] font-semibold text-white dark:text-slate-100 opacity-0 shadow-float transition-opacity duration-300 ease-out z-50 hover-capable:group-hover:opacity-100 hidden sm:flex items-center gap-1.5"
        >
          <span>
            {themeModeLabel(mode)}
            {mode === 'system'
              ? ` (${effective === 'dark' ? dataPoints['header.theme.dark'] || 'Dark' : dataPoints['header.theme.light'] || 'Light'})`
              : ''}
          </span>
          <kbd className="px-1 py-0.2 rounded bg-white/10 border border-white/15 text-[9px] font-mono text-ink-muted-on-dark uppercase">
            Shift+T
          </kbd>
        </span>
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
        className={`group flex w-full items-center gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-ink-on-dark hover:text-white transition-all duration-300 ease-out text-sm font-medium active:scale-[0.99] cursor-pointer ${FOCUS_RING}`}
      >
        <span className="relative flex items-center justify-center transition-transform duration-300 ease-out group-hover:rotate-12">
          <Icon size={18} aria-hidden="true" />
        </span>
        <DataPoint as="span" name="header.theme.appearance" initialData={dataPoints}>
          Appearance
        </DataPoint>
        <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted-on-dark">
          <DataPoint as="span" name={`header.theme.mode_${mode}`} initialData={dataPoints}>
            {themeModeLabel(mode)}
          </DataPoint>
          {mode === 'system' && (
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ring-1 ring-secondary ${
                effective === 'dark' ? 'bg-sky-400' : 'bg-amber-400'
              }`}
            />
          )}
        </span>
      </button>
      <fieldset className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
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
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all duration-300 ease-out active:scale-95 cursor-pointer ${
                isSelected
                  ? 'bg-amber-400 text-secondary shadow-raised font-black ring-1 ring-amber-300/50'
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
