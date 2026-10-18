'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { type ThemeMode, themeModeLabel } from '@/lib/theme';
import { cycleThemeMode, subscribeThemeHud, type ThemeHudEvent } from './theme-store';

const MODE_ICON: Record<ThemeMode, typeof Monitor> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

/**
 * Floating Sensory Theme HUD & Global Keyboard Shortcut Controller.
 *
 * Provides Apple-grade tactile feedback when theme modes change:
 * 1. Global shortcut `Shift + T` (or `Cmd/Ctrl + Shift + L`) toggles theme modes
 *    from anywhere across the site without interfering with form inputs.
 * 2. Sensory floating HUD pill confirms palette transitions with accessible
 *    announcements (`role="status"`, `aria-live="polite"`).
 * 3. Auto-dismisses smoothly after 2.2s.
 */
export function ThemeHud() {
  const [hudEvent, setHudEvent] = useState<ThemeHudEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to theme mode mutations across the application
  useEffect(() => {
    return subscribeThemeHud((event) => {
      setHudEvent(event);
      setIsVisible(true);

      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      hideTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 2200);
    });
  }, []);

  // Global tactile keyboard shortcuts (Shift+T and Cmd/Ctrl+Shift+L)
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

      // Shift + T (without Cmd/Ctrl/Alt)
      if (e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        cycleThemeMode();
        return;
      }

      // Cmd/Ctrl + Shift + L
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        cycleThemeMode();
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
        hideTimerRef.current = setTimeout(() => {
          setIsVisible(false);
        }, 1500);
      }}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[140] transition-all duration-300 ease-out ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
          : 'opacity-0 translate-y-3 scale-95 pointer-events-none'
      }`}
    >
      <button
        type="button"
        onClick={() => setIsVisible(false)}
        aria-label="Dismiss theme notification"
        className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-secondary/95 dark:bg-slate-900/95 text-white backdrop-blur-xl border border-white/15 dark:border-white/10 shadow-float text-xs font-semibold tracking-wide cursor-pointer active:scale-95 transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-bright"
      >
        <span
          aria-hidden="true"
          className="flex items-center justify-center size-5 rounded-full bg-white/10 text-accent-gold dark:text-sky-400"
        >
          <Icon size={12} />
        </span>
        <span className="font-medium text-slate-100">
          <strong className="font-bold text-white">{modeText}</strong> Palette Active
        </span>
        <span className="text-white/40 text-[10px]" aria-hidden="true">
          ·
        </span>
        <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 text-[10px] font-mono text-ink-muted-on-dark uppercase">
          Shift+T
        </kbd>
      </button>
    </aside>
  );
}
