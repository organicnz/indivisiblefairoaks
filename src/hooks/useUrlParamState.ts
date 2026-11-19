'use client';

import { useCallback, useEffect, useState } from 'react';

type HistoryMode = 'replace' | 'push';

type UseUrlParamStateOptions = {
  /** When false the hook behaves as ordinary local state. */
  enabled?: boolean;
  /** Filter changes replace the current entry by default, as elsewhere on the site. */
  history?: HistoryMode;
};

function currentValue(name: string): string {
  return new URLSearchParams(window.location.search).get(name) ?? '';
}

function writeValue(name: string, value: string, mode: HistoryMode): void {
  const params = new URLSearchParams(window.location.search);
  const clean = value.trim();
  if (clean) params.set(name, clean);
  else params.delete(name);

  const query = params.toString();
  const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return;

  const method = mode === 'push' ? 'pushState' : 'replaceState';
  window.history[method](window.history.state, '', next);
}

/**
 * A string filter backed by one query parameter.
 *
 * The URL is read in an effect rather than during render so these pages stay
 * statically prerenderable. A `popstate` listener applies browser back/forward
 * changes, and writes preserve every unrelated query parameter and the hash.
 */
export function useUrlParamState(
  name: string,
  { enabled = true, history = 'replace' }: UseUrlParamStateOptions = {}
) {
  const [value, setValue] = useState('');

  useEffect(() => {
    const apply = () => {
      const next = enabled ? currentValue(name) : '';
      setValue(next);
    };

    apply();
    if (!enabled) return;
    window.addEventListener('popstate', apply);
    return () => window.removeEventListener('popstate', apply);
  }, [enabled, name]);

  const update = useCallback(
    (next: string, mode: HistoryMode = history) => {
      setValue(next);
      if (enabled) writeValue(name, next, mode);
    },
    [enabled, history, name]
  );

  return [value, update] as const;
}
