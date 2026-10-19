'use client';

import { Monitor, Moon, Sun, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { THEME_ORDER, type ThemeMode, themeModeLabel } from '@/lib/theme';
import { cycleThemeMode, setThemeMode, subscribeThemeHud, type ThemeHudEvent } from './theme-store';

const MODE_ICON: Record<ThemeMode, typeof Monitor> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

function SegmentedHudPill({ mode }: { mode: ThemeMode }) {
  const prefersReduced = useReducedMotion();

  const pillColor =
    mode === 'dark'
      ? 'bg-sky-400 text-secondary shadow-xs ring-1 ring-sky-300/50'
      : mode === 'light'
        ? 'bg-amber-400 text-secondary shadow-xs ring-1 ring-amber-300/50'
        : 'bg-emerald-400 text-secondary shadow-xs ring-1 ring-emerald-300/50';

  if (prefersReduced) {
    return <span aria-hidden="true" className={`absolute inset-0 rounded-full ${pillColor}`} />;
  }

  return (
    <motion.span
      layoutId="theme-hud-active-pill"
      aria-hidden="true"
      className={`absolute inset-0 rounded-full ${pillColor}`}
      transition={{
        type: 'spring',
        stiffness: 500,
        damping: 35,
        mass: 0.8,
      }}
      style={{ originX: 0.5, originY: 0.5 }}
    />
  );
}

/**
 * Floating Sensory Theme HUD & Global Keyboard Shortcut Controller.
 *
 * Provides Apple-grade tactile feedback when theme modes change:
 * 1. Global shortcut `Shift + T` (or `Cmd/Ctrl + Shift + L`) toggles theme modes
 *    from anywhere across the site without interfering with form inputs.
 * 2. `Alt + 1` (System), `Alt + 2` (Light), `Alt + 3` (Dark) direct shortcuts,
 *    and instant `1`, `2`, `3` selection while the HUD is visible.
 * 3. `ArrowLeft` / `ArrowRight` (or `ArrowUp` / `ArrowDown`) to cycle themes while the HUD is open.
 * 4. Interactive segmented pill buttons directly clickable/tappable on mobile and desktop.
 * 5. Sensory floating HUD pill confirms palette transitions with accessible
 *    announcements (`role="status"`, `aria-live="polite"`).
 * 6. Micro countdown drain progress indicator with hover pause and auto-dismiss after 2.2s.
 */
export function ThemeHud() {
  const [hudEvent, setHudEvent] = useState<ThemeHudEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const isVisibleRef = useRef(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  const resetHideTimer = useCallback((ms = 2200) => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, ms);
  }, []);

  const resetHideTimerRef = useRef(resetHideTimer);
  useEffect(() => {
    resetHideTimerRef.current = resetHideTimer;
  }, [resetHideTimer]);

  // Subscribe to theme mode mutations across the application
  useEffect(() => {
    return subscribeThemeHud((event) => {
      setHudEvent(event);
      setIsVisible(true);
      resetHideTimerRef.current(2200);
    });
  }, []);

  // Global tactile keyboard shortcuts (Shift+T, Cmd/Ctrl+Shift+L, Alt+1/2/3, Arrow keys and 1/2/3 while active)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        target &&
        typeof HTMLElement !== 'undefined' &&
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.getAttribute('role') === 'textbox' ||
          target.getAttribute('role') === 'combobox' ||
          target.getAttribute('role') === 'searchbox')
      ) {
        return;
      }

      if (e.key === 'Escape') {
        setIsVisible(false);
        return;
      }

      // Alt + 1/2/3 (or Ctrl + Alt + 1/2/3) global direct theme switching (on macOS, Alt/Option produces characters like ¡, ™, £ so e.code is checked)
      if (e.altKey && !e.metaKey && !e.shiftKey) {
        if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') {
          e.preventDefault();
          setThemeMode('system');
          return;
        }
        if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') {
          e.preventDefault();
          setThemeMode('light');
          return;
        }
        if (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3') {
          e.preventDefault();
          setThemeMode('dark');
          return;
        }
      }

      // Direct interactive keyboard controls when HUD is actively visible
      if (isVisibleRef.current && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        // Arrow keys to cycle themes
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          cycleThemeMode('next');
          resetHideTimerRef.current(2500);
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          cycleThemeMode('prev');
          resetHideTimerRef.current(2500);
          return;
        }
        if (e.key === 'Home') {
          e.preventDefault();
          setThemeMode('system');
          resetHideTimerRef.current(2500);
          return;
        }
        if (e.key === 'End') {
          e.preventDefault();
          setThemeMode('dark');
          resetHideTimerRef.current(2500);
          return;
        }

        // T key while HUD is open cycles forward
        if (e.key.toLowerCase() === 't' || e.code === 'KeyT') {
          e.preventDefault();
          cycleThemeMode('next');
          resetHideTimerRef.current(2500);
          return;
        }

        // Direct 1/2/3 selection
        if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') {
          e.preventDefault();
          setThemeMode('system');
          resetHideTimerRef.current(2500);
          return;
        }
        if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') {
          e.preventDefault();
          setThemeMode('light');
          resetHideTimerRef.current(2500);
          return;
        }
        if (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3') {
          e.preventDefault();
          setThemeMode('dark');
          resetHideTimerRef.current(2500);
          return;
        }
      }

      // Shift + Alt + T: Cycle backward (on macOS, Shift+Option+T produces ˇ so e.code is checked)
      if (
        e.shiftKey &&
        e.altKey &&
        !e.metaKey &&
        !e.ctrlKey &&
        (e.key.toLowerCase() === 't' || e.code === 'KeyT')
      ) {
        e.preventDefault();
        cycleThemeMode('prev');
        return;
      }

      // Shift + T (without Cmd/Ctrl/Alt): Cycle forward
      if (
        e.shiftKey &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        (e.key.toLowerCase() === 't' || e.code === 'KeyT')
      ) {
        e.preventDefault();
        cycleThemeMode('next');
        return;
      }

      // Cmd/Ctrl + Shift + L or Cmd/Ctrl + Shift + D: Developer toggle shortcuts
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        !e.altKey &&
        (e.key.toLowerCase() === 'l' ||
          e.code === 'KeyL' ||
          e.key.toLowerCase() === 'd' ||
          e.code === 'KeyD')
      ) {
        e.preventDefault();
        cycleThemeMode('next');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  const handleHudSegmentKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    current: ThemeMode
  ) => {
    const currentIndex = THEME_ORDER.indexOf(current);
    let targetIndex = -1;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      targetIndex = (currentIndex + 1) % THEME_ORDER.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      targetIndex = (currentIndex - 1 + THEME_ORDER.length) % THEME_ORDER.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      e.stopPropagation();
      targetIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      e.stopPropagation();
      targetIndex = THEME_ORDER.length - 1;
    }

    if (targetIndex >= 0) {
      const targetMode = THEME_ORDER[targetIndex];
      const targetBtn = e.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
        `button[data-theme-mode="${targetMode}"]`
      );
      targetBtn?.focus();
      const rect = targetBtn?.getBoundingClientRect();
      const coords = rect
        ? {
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
          }
        : undefined;
      setThemeMode(targetMode, coords);
      resetHideTimerRef.current(2500);
    }
  };

  if (!hudEvent) return null;

  const Icon = MODE_ICON[hudEvent.mode];
  const modeText =
    hudEvent.mode === 'system'
      ? `System (${hudEvent.effective === 'dark' ? 'Dark' : 'Light'})`
      : `${themeModeLabel(hudEvent.mode)}`;

  return (
    <aside
      aria-label="Theme mode indicator"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      onMouseEnter={() => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      }}
      onMouseLeave={() => {
        resetHideTimerRef.current(1500);
      }}
      onFocus={() => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          resetHideTimerRef.current(1500);
        }
      }}
      className={`fixed bottom-[calc(1.5rem+var(--safe-area-bottom))] left-1/2 -translate-x-1/2 z-[140] transition-all duration-300 ease-out ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
          : 'opacity-0 translate-y-3 scale-95 pointer-events-none'
      }`}
    >
      <div
        className={`group relative overflow-hidden inline-flex items-center gap-2.5 p-1.5 pl-3.5 pr-2 rounded-full bg-secondary/95 dark:bg-secondary/98 text-white backdrop-blur-xl border border-white/15 dark:border-white/10 text-xs font-semibold tracking-wide transition-all duration-300 ${
          hudEvent.mode === 'dark'
            ? 'shadow-[0_12px_36px_-8px_rgba(21,93,252,0.45)] ring-1 ring-sky-400/30'
            : hudEvent.mode === 'light'
              ? 'shadow-[0_12px_36px_-8px_rgba(245,158,11,0.45)] ring-1 ring-amber-400/30'
              : 'shadow-[0_12px_36px_-8px_rgba(16,185,129,0.45)] ring-1 ring-emerald-400/30'
        }`}
      >
        {/* Left Status Indicator */}
        <div className="flex items-center gap-2 select-none">
          <span
            aria-hidden="true"
            className={`flex items-center justify-center size-5 rounded-full transition-colors duration-300 ${
              hudEvent.mode === 'dark'
                ? 'bg-sky-500/20 text-sky-400 ring-1 ring-sky-400/30'
                : hudEvent.mode === 'light'
                  ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-400/30'
                  : 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-400/30'
            }`}
          >
            <Icon size={12} />
          </span>
          <span className="font-medium text-ink-on-dark text-xs whitespace-nowrap">
            <strong className="font-bold text-white">{modeText}</strong> Palette Active
          </span>
        </div>

        <span className="text-white/20 select-none text-[10px]" aria-hidden="true">
          |
        </span>

        {/* Clickable / Tappable Segmented Controls */}
        <fieldset
          aria-label="Theme mode switcher"
          className="inline-flex items-center gap-1 p-0.5 rounded-full bg-white/5 dark:bg-black/30 border border-white/10 m-0"
        >
          <legend className="sr-only">Theme mode switcher</legend>
          {THEME_ORDER.map((m, idx) => {
            const ItemIcon = MODE_ICON[m];
            const isActive = hudEvent.mode === m;
            const keyNum = idx + 1;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={isActive}
                data-theme-mode={m}
                onClick={(e) => {
                  e.stopPropagation();
                  setThemeMode(m, { x: e.clientX, y: e.clientY });
                  resetHideTimerRef.current(2500);
                }}
                onKeyDown={(e) => handleHudSegmentKeyDown(e, m)}
                className={`group/btn relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors duration-200 ease-out cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white ${
                  isActive
                    ? 'text-secondary font-black'
                    : 'text-ink-on-dark hover:text-white hover:bg-white/10 font-medium'
                }`}
                title={`Switch to ${themeModeLabel(m)} theme (Press ${keyNum} or Alt+${keyNum})`}
              >
                {isActive && <SegmentedHudPill mode={m} />}
                <ItemIcon size={11} aria-hidden="true" className="relative z-10" />
                <span className="hidden sm:inline font-bold tracking-tight relative z-10">
                  {themeModeLabel(m)}
                </span>
                <kbd
                  className={`relative z-10 px-1 py-0.5 rounded text-[9px] font-mono leading-none ${
                    isActive
                      ? 'bg-black/20 text-secondary font-bold'
                      : 'bg-white/10 text-white/50 group-hover/btn:text-white'
                  }`}
                >
                  {keyNum}
                </kbd>
              </button>
            );
          })}
        </fieldset>

        {/* Global shortcut hint */}
        <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-white/40 font-mono select-none pl-0.5">
          <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 text-[9px] font-mono text-ink-muted-on-dark uppercase">
            Shift+T
          </kbd>
          <span className="text-[9px] text-white/30" title="ArrowLeft/ArrowRight to cycle themes">
            [←·→]
          </span>
        </div>

        {/* Dedicated Dismiss Button */}
        <button
          type="button"
          onClick={() => setIsVisible(false)}
          aria-label="Dismiss theme notification"
          title="Dismiss (Esc)"
          className="size-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white ml-0.5"
        >
          <X size={12} aria-hidden="true" />
        </button>

        {/* Micro countdown drain bar */}
        <span
          key={hudEvent.timestamp}
          aria-hidden="true"
          className={`absolute bottom-0 left-0 h-[2.5px] rounded-b-full transition-colors duration-300 group-hover:[animation-play-state:paused] ${
            hudEvent.mode === 'dark'
              ? 'bg-sky-400'
              : hudEvent.mode === 'light'
                ? 'bg-amber-400'
                : 'bg-emerald-400'
          }`}
          style={{
            animation: isVisible ? 'theme-hud-drain 2.2s linear forwards' : 'none',
          }}
        />
      </div>
    </aside>
  );
}
