'use client';

import { useEffect, useState } from 'react';
import type { CmsEditTarget } from '@/lib/edit-target';
import { createClient } from '@/lib/supabase';

export interface EditContextState {
  /** True while the admin check is in flight (renders an exact-size skeleton). */
  loading: boolean;
  isAdmin: boolean;
  target: CmsEditTarget | null;
}

/**
 * Editorial-button context for the header and the nav drawer.
 *
 * Results are cached per pathname in-module, so the header button and the
 * drawer row share one answer. Anonymous visitors never fetch: with no
 * session there is no admin to be, and the round trip would spend shared
 * Fluid CPU to learn nothing.
 */
const contextCache = new Map<string, { isAdmin: boolean; target: CmsEditTarget | null }>();

export function useEditContext(pathname: string): EditContextState {
  const [state, setState] = useState<EditContextState>(() => {
    const cached = contextCache.get(pathname);
    return cached
      ? { loading: false, isAdmin: cached.isAdmin, target: cached.target }
      : { loading: true, isAdmin: false, target: null };
  });

  useEffect(() => {
    const cached = contextCache.get(pathname);
    if (cached) {
      setState({ loading: false, isAdmin: cached.isAdmin, target: cached.target });
      return;
    }
    let cancelled = false;
    setState({ loading: true, isAdmin: false, target: null });
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return;
        if (!session) {
          const answer = { isAdmin: false, target: null };
          contextCache.set(pathname, answer);
          setState({ loading: false, ...answer });
          return;
        }
        return fetch(`/api/admin/edit-context?path=${encodeURIComponent(pathname)}`, {
          cache: 'no-store',
        })
          .then((res) => (res.ok ? res.json() : { isAdmin: false, target: null }))
          .then((answer) => {
            if (cancelled) return;
            const shaped = {
              isAdmin: answer.isAdmin === true,
              target: (answer.target ?? null) as CmsEditTarget | null,
            };
            contextCache.set(pathname, shaped);
            setState({ loading: false, ...shaped });
          })
          .catch(() => {
            if (!cancelled) setState({ loading: false, isAdmin: false, target: null });
          });
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return state;
}
