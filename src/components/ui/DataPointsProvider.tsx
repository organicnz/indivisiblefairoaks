'use client';

import { createContext, type ReactNode, useContext } from 'react';

/**
 * The server reads the globally needed data-point groups once per cached
 * layout render and passes them here. Pages that own client widgets add their
 * own group through the widget's `initialData` prop, so the first paint uses
 * database copy without putting the whole table on every page. Nested
 * providers merge rather than replace. `useDataPoints` still refreshes its
 * group after mount, so an editor's save propagates without a reload.
 */
const DataPointsContext = createContext<Record<string, string> | null>(null);

export function DataPointsProvider({
  dataPoints,
  children,
}: {
  dataPoints: Record<string, string>;
  children: ReactNode;
}) {
  const parent = useContext(DataPointsContext);
  const value = parent ? { ...parent, ...dataPoints } : dataPoints;
  return <DataPointsContext.Provider value={value}>{children}</DataPointsContext.Provider>;
}

export function useDataPointsSnapshot(): Record<string, string> | null {
  return useContext(DataPointsContext);
}
