'use client';

import { createContext, type ReactNode, useContext } from 'react';

/**
 * The server reads the whole data_points table once per cached layout render
 * and passes it here. Client widgets that used to paint their JSX literals
 * until their own fetch resolved can now render the database copy on the first
 * paint. `useDataPoints` still refreshes its group after mount, so an editor's
 * save propagates without a reload.
 */
const DataPointsContext = createContext<Record<string, string> | null>(null);

export function DataPointsProvider({
  dataPoints,
  children,
}: {
  dataPoints: Record<string, string>;
  children: ReactNode;
}) {
  return <DataPointsContext.Provider value={dataPoints}>{children}</DataPointsContext.Provider>;
}

export function useDataPointsSnapshot(): Record<string, string> | null {
  return useContext(DataPointsContext);
}
