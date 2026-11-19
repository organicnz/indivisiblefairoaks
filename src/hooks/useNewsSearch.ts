'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveNewsQuery } from '@/lib/news-text';
import { useUrlParamState } from './useUrlParamState';

type UseNewsSearchOptions = {
  /** Sync the query to this URL parameter when provided. */
  urlParam?: string;
};

/**
 * One controlled search contract for the public archives and the admin
 * manager. `effectiveQuery` is the query that is actually searchable; the raw
 * value stays in the input so whitespace-only text does not look like an
 * active search.
 */
export function useNewsSearch(initialQuery = '', { urlParam }: UseNewsSearchOptions = {}) {
  const [urlQuery, setUrlQuery] = useUrlParamState(urlParam ?? 'q', {
    enabled: Boolean(urlParam),
  });
  const [searchQuery, setSearchQueryState] = useState(initialQuery);

  // The URL wins when the visitor follows a shared link or presses back/forward.
  useEffect(() => {
    if (!urlParam) return;
    setSearchQueryState(urlQuery);
  }, [urlParam, urlQuery]);

  const effectiveQuery = useMemo(() => resolveNewsQuery(searchQuery), [searchQuery]);
  const setSearchQuery = useCallback(
    (value: string) => {
      setSearchQueryState(value);
      if (urlParam) setUrlQuery(value);
    },
    [setUrlQuery, urlParam]
  );
  const clearSearch = useCallback(() => {
    setSearchQueryState('');
    if (urlParam) setUrlQuery('');
  }, [setUrlQuery, urlParam]);

  return {
    searchQuery,
    setSearchQuery,
    effectiveQuery,
    searching: effectiveQuery.length > 0,
    clearSearch,
  };
}
