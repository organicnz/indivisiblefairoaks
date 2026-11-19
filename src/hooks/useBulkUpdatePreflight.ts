'use client';

import { useCallback, useRef, useState } from 'react';
import { previewBulkCRMContactUpdate } from '@/lib/actions/crm';
import type {
  ConsentDecision,
  CRMBulkUpdateField,
  CRMBulkUpdatePreview,
  CRMContactStatus,
} from '@/types/crm';

export type BulkUpdatePreflightPlan = {
  contactIds: string[];
  field: CRMBulkUpdateField;
  value: string;
};

/**
 * Fetch the read-only summary that sits between a bulk control and its write.
 *
 * The selection can span pages, so the visible rows are not enough to describe
 * the current distribution. The plan captures its contact IDs at the moment the
 * organizer picks an action; confirming applies to that same set even if the
 * table changes behind the dialog.
 */
export function useBulkUpdatePreflight() {
  const [plan, setPlan] = useState<BulkUpdatePreflightPlan | null>(null);
  const [preview, setPreview] = useState<CRMBulkUpdatePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const close = useCallback(() => {
    requestSeq.current += 1;
    setPlan(null);
    setPreview(null);
    setError(null);
    setLoading(false);
  }, []);

  const begin = useCallback(async (next: BulkUpdatePreflightPlan) => {
    if (next.contactIds.length === 0) return;

    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    setPlan(next);
    setPreview(null);
    setError(null);
    setLoading(true);

    try {
      const res = await previewBulkCRMContactUpdate({
        contactIds: next.contactIds,
        ...(next.field === 'status' ? { status: next.value as CRMContactStatus } : {}),
        ...(next.field === 'consent' ? { consent: next.value as ConsentDecision } : {}),
        ...(next.field === 'district' ? { district: next.value } : {}),
        ...(next.field === 'tags' ? { addTag: next.value } : {}),
      });

      if (requestSeq.current !== seq) return;
      if (!res.success || !res.preview) {
        setError(res.error ?? 'Could not build the bulk update summary');
        return;
      }
      setPreview(res.preview);
    } catch (err) {
      if (requestSeq.current !== seq) return;
      setError(err instanceof Error ? err.message : 'Could not build the bulk update summary');
    } finally {
      if (requestSeq.current === seq) setLoading(false);
    }
  }, []);

  return { plan, preview, loading, error, begin, close };
}
