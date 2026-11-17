'use client';

import { useEffect, useRef } from 'react';
import { US_STATE_OPTIONS } from './us-state-options';

/**
 * State changes invalidate a city selection, so clear the hidden city field
 * before the surrounding GET form submits. Without this, changing from
 * Sacramento, CA to Oregon would quietly send both CA and OR filters.
 */
export function SourceReportStateSelect({ defaultValue }: { defaultValue: string }) {
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (selectRef.current) selectRef.current.value = defaultValue;
  }, [defaultValue]);

  return (
    <select
      ref={selectRef}
      id="web-reports-state"
      name="state"
      defaultValue={defaultValue}
      onChange={(event) => {
        const form = event.currentTarget.form;
        const city = form?.querySelector<HTMLInputElement>('input[name="city"]');
        if (city) city.value = '';
      }}
      className="mt-1 min-h-11 w-full border border-border bg-background px-2.5 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <option value="">All states</option>
      {US_STATE_OPTIONS.map((state) => (
        <option key={state.code} value={state.code}>
          {state.name}
        </option>
      ))}
    </select>
  );
}
