'use client';

import { useEffect, useState } from 'react';
import type { CmsEditTarget } from '@/lib/edit-target';
import { createClient } from '@/lib/supabase';

/**
 * Editorial-button context for the header and the nav drawer.
 *
 * One question matters: is this visitor an admin, and if so is there a CMS row
 * behind the path they are on? Everything else the visual editor needs — which
 * sections exist, which block each frame addresses, whether the document is
 * dirty — lives in the overlay, because the overlay is the component that has
 * the block model.
 *
 * A previous revision also carried a `visualEditTarget` here, duplicated from
 * `src/types/crm.ts`, that no component read. A second copy of a model is
 * worse than no model: it looks authoritative and it is not.
 */

export interface EditContextState {
  /** True while the admin check is in flight (renders an exact-size skeleton). */
  loading: boolean;
  isAdmin: boolean;
  target: CmsEditTarget | null;
}

const IDLE: EditContextState = {
  loading: true,
  isAdmin: false,
  target: null,
};

/**
 * Memoised per pathname, because the header, the drawer row and the overlay all
 * ask about the same path on the same navigation and each firing its own
 * request would triple the admin lookups on every route change.
 *
 * Admin status is a property of the session, not the path, so a non-admin
 * answer is cached and reused for every path too — one negative answer rather
 * one per route.
 */
const contextCache = new Map<string, EditContextState>();

const NOT_ADMIN: EditContextState = { loading: false, isAdmin: false, target: null };

export function useEditContext(pathname: string): EditContextState {
  const [state, setState] = useState<EditContextState>(() => contextCache.get(pathname) ?? IDLE);

  useEffect(() => {
    const cached = contextCache.get(pathname);
    if (cached) {
      setState(cached);
      return;
    }

    let cancelled = false;
    setState(IDLE);

    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return;
        if (!session) {
          contextCache.set(pathname, NOT_ADMIN);
          setState(NOT_ADMIN);
          return;
        }
        return fetch(`/api/admin/edit-context?path=${encodeURIComponent(pathname)}`, {
          cache: 'no-store',
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((answer) => {
            if (cancelled) return;
            const resolved: EditContextState = {
              loading: false,
              isAdmin: answer?.isAdmin === true,
              target: answer?.target ?? null,
            };
            contextCache.set(pathname, resolved);
            setState(resolved);
          })
          .catch(() => {
            if (cancelled) return;
            // A failed lookup reads as "not an admin" rather than "unknown".
            // The editor surfaces that the operator cannot see are exactly the
            // ones that should not appear, so failing closed is also failing
            // correctly here.
            contextCache.set(pathname, NOT_ADMIN);
            setState(NOT_ADMIN);
          });
      })
      .catch(() => {
        if (cancelled) return;
        setState(NOT_ADMIN);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return state;
}
