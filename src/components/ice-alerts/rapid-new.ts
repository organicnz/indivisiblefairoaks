'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RapidAlert } from './rapid-types';

export const RAPID_SEEN_KEY = 'ice-rapid-seen-v1';
const MAX_SEEN_IDS = 500;

export function diffNewAlertIds(
  alertIds: ReadonlySet<string>,
  seen: ReadonlySet<string>
): ReadonlySet<string> {
  const next = new Set<string>();
  for (const id of alertIds) {
    if (!seen.has(id)) next.add(id);
  }
  return next;
}

export function readSeenAlertIds(): Set<string> | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(RAPID_SEEN_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      parsed.length > MAX_SEEN_IDS ||
      !parsed.every((id): id is string => typeof id === 'string' && id.length > 0)
    ) {
      window.localStorage.removeItem(RAPID_SEEN_KEY);
      return null;
    }

    return new Set(parsed);
  } catch {
    return null;
  }
}

export function writeSeenAlertIds(alertIds: Iterable<string>) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      RAPID_SEEN_KEY,
      JSON.stringify([...alertIds].slice(0, MAX_SEEN_IDS))
    );
  } catch {
    // Storage is optional. A private-mode failure leaves the live feed intact
    // and simply means this browser cannot show a new-since-last-visit count.
  }
}

/**
 * Compare the current live feed's stable alert IDs with the IDs this browser
 * last recorded. A first visit establishes a baseline and deliberately reports
 * zero new rows; otherwise, every new ID is a real row from the current feed.
 */
export function useNewRapidAlerts(alerts: readonly RapidAlert[], enabled: boolean) {
  const signature = useMemo(() => alerts.map((alert) => alert.id).join('\n'), [alerts]);
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(() => new Set());
  const seenRef = useRef<Set<string> | null>(null);
  const comparedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!signature) {
      setNewIds(new Set());
      return;
    }
    if (comparedSignatureRef.current === signature) return;
    comparedSignatureRef.current = signature;

    const current = new Set(alerts.map((alert) => alert.id));
    if (seenRef.current === null) {
      seenRef.current = readSeenAlertIds();
    }
    const seen = seenRef.current;
    setNewIds(seen && seen.size > 0 ? diffNewAlertIds(current, seen) : new Set());
    seenRef.current = current;
    writeSeenAlertIds(current);
  }, [alerts, enabled, signature]);

  return newIds;
}
