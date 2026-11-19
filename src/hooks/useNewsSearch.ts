'use client';

import { useCallback, useMemo, useState } from 'react';
import { resolveNewsQuery } from '@/lib/news-text';

/**
 * One controlled search contract for the public archives and the admin
 * manager. `effectiveQuery` is the query that is actually searchable; the raw
 * value stays in the input so whitespace-only text does not look like an
 * active search.
 */
export function useNewsSearch(initialQuery = '') {
  const [searchQuery, setSearchQueryState] = useState(initialQuery);
  const effectiveQuery = useMemo(() => resolveNewsQuery(searchQuery), [searchQuery]);
  const setSearchQuery = useCallback((value: string) => setSearchQueryState(value), []);
  const clearSearch = useCallback(() => setSearchQueryState(''), []);

  return {
    searchQuery,
    setSearchQuery,
    effectiveQuery,
    searching: effectiveQuery.length > 0,
    clearSearch,
  };
}
