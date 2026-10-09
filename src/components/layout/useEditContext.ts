'use client';

import { useEffect, useState } from 'react';
import type { CmsEditTarget } from '@/lib/edit-target';
import { createClient } from '@/lib/supabase';

export interface EditContextState {
  /** True while the admin check is in flight (renders an exact-size skeleton). */
  loading: boolean;
  isAdmin: boolean;
  target: CmsEditTarget | null;
  /** Visual editor specific state */
  visualEditEnabled: boolean;
  visualEditTarget: VisualEditTarget | null;
}

/** Visual editor target resolution. */
export interface VisualEditTarget {
  kind: 'visual-section';
  sectionId: string;
  title: string;
  type: 'cms' | 'crm';
}

/** Editorial-button context for the header and the nav drawer. */
const contextCache = new Map<
  string,
  {
    loading: boolean;
    isAdmin: boolean;
    target: CmsEditTarget | null;
    visualEditEnabled: boolean;
    visualEditTarget: VisualEditTarget | null;
  }
>();

/**
 * Reconcile the cached state with a new state object.
 * The URL/query param wins when it has an opinion, otherwise fall back to
 * the stored preference. This keeps the mode consistent across navigations.
 */
function reconcileEditContext(
  cached:
    | {
        loading: boolean;
        isAdmin: boolean;
        target: CmsEditTarget | null;
        visualEditEnabled: boolean;
        visualEditTarget: VisualEditTarget | null;
      }
    | undefined,
  urlEnabled?: boolean,
  urlTarget?: VisualEditTarget | null
): {
  loading: boolean;
  isAdmin: boolean;
  target: CmsEditTarget | null;
  visualEditEnabled: boolean;
  visualEditTarget: VisualEditTarget | null;
} {
  const next = { ...cached };

  // URL takes precedence for visual edit mode
  if (urlEnabled !== undefined) {
    next.visualEditEnabled = urlEnabled;
  }
  if (urlTarget !== undefined) {
    next.visualEditTarget = urlTarget;
  }

  return next as {
    loading: boolean;
    isAdmin: boolean;
    target: CmsEditTarget | null;
    visualEditEnabled: boolean;
    visualEditTarget: VisualEditTarget | null;
  };
}

export function useEditContext(pathname: string): EditContextState {
  const [state, setState] = useState<EditContextState>(() => {
    const cached = contextCache.get(pathname);
    if (cached) {
      return {
        loading: cached.loading,
        isAdmin: cached.isAdmin,
        target: cached.target,
        visualEditEnabled: cached.visualEditEnabled,
        visualEditTarget: cached.visualEditTarget,
      };
    }
    // Default: visual editing off, no admin context
    return {
      loading: true,
      isAdmin: false,
      target: null,
      visualEditEnabled: false,
      visualEditTarget: null,
    };
  });

  useEffect(() => {
    const cached = contextCache.get(pathname);
    if (cached) {
      const reconciled = reconcileEditContext(cached);
      setState({
        loading: false,
        isAdmin: reconciled.isAdmin,
        target: reconciled.target,
        visualEditEnabled: reconciled.visualEditEnabled,
        visualEditTarget: reconciled.visualEditTarget,
      });
      return;
    }

    let cancelled = false;
    setState({
      loading: true,
      isAdmin: false,
      target: null,
      visualEditEnabled: false,
      visualEditTarget: null,
    });

    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return;
        if (!session) {
          const answer = {
            loading: false,
            isAdmin: false,
            target: null,
            visualEditEnabled: false,
            visualEditTarget: null,
          };
          contextCache.set(pathname, answer);
          setState(answer);
          return;
        }
        fetch(`/api/admin/edit-context?path=${encodeURIComponent(pathname)}`, {
          cache: 'no-store',
        })
          .then((res) => {
            if (cancelled) return;
            if (!res.ok) {
              const answer = {
                loading: false,
                isAdmin: false,
                target: null,
                visualEditEnabled: false,
                visualEditTarget: null,
              };
              contextCache.set(pathname, answer);
              setState(answer);
              return;
            }
            return res.json();
          })
          .then((answer) => {
            if (cancelled) return;
            const cachedAnswer = {
              loading: false,
              isAdmin: answer.isAdmin === true,
              target: answer.target ?? null,
              visualEditEnabled: answer.visualEditEnabled ?? false,
              visualEditTarget: answer.visualEditTarget ?? null,
            };
            contextCache.set(pathname, cachedAnswer);
            setState(cachedAnswer);
          })
          .catch(() => {
            if (!cancelled) {
              setState({
                loading: false,
                isAdmin: false,
                target: null,
                visualEditEnabled: false,
                visualEditTarget: null,
              });
            }
          });
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return state;
}
