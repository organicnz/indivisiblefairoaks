'use client';

import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import {
  CRM_CONTACT_BULK_CONSENT_OPTIONS,
  CRM_CONTACT_BULK_STATUS_OPTIONS,
} from '@/lib/crm-contact-options';
import type {
  CRMBulkUpdateDistributionEntry,
  CRMBulkUpdateField,
  CRMBulkUpdatePreview,
} from '@/types/crm';

const FIELD_NAMES: Record<CRMBulkUpdateField, string> = {
  status: 'status',
  consent: 'email consent',
  district: 'district',
  tags: 'tags',
};

function optionLabel(
  options: readonly { value: string; label?: string; bulkLabel?: string }[],
  value: string
): string {
  return options.find((option) => option.value === value)?.label ?? value.replace('_', ' ');
}

function currentValueLabel(field: CRMBulkUpdateField, value: string): string {
  if (!value) {
    if (field === 'district') return 'No district';
    if (field === 'tags') return 'No tags';
    return 'Unknown';
  }
  if (field === 'status') return optionLabel(CRM_CONTACT_BULK_STATUS_OPTIONS, value);
  if (field === 'consent') {
    return (
      CRM_CONTACT_BULK_CONSENT_OPTIONS.find((option) => option.value === value)?.label ?? value
    );
  }
  return field === 'tags' ? `#${value}` : value;
}

function plannedValueLabel(field: CRMBulkUpdateField, value: string): string {
  if (field === 'consent') {
    return (
      CRM_CONTACT_BULK_CONSENT_OPTIONS.find((option) => option.value === value)?.bulkLabel ?? value
    );
  }
  return currentValueLabel(field, value);
}

function plannedSentence(preview: CRMBulkUpdatePreview): string {
  if (preview.field === 'tags') return `Add #${preview.plannedValue} to the selected contacts`;
  if (preview.field === 'district') return `Set district to ${preview.plannedValue}`;
  return `Set ${FIELD_NAMES[preview.field]} to ${plannedValueLabel(
    preview.field,
    preview.plannedValue
  )}`;
}

function DistributionList({
  field,
  entries,
}: {
  field: CRMBulkUpdateField;
  entries: CRMBulkUpdateDistributionEntry[];
}) {
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No selected contacts still exist.</p>;
  }

  return (
    <ul className="max-h-48 overflow-y-auto overscroll-contain rounded-xl border border-border divide-y divide-border">
      {entries.map((entry) => (
        <li
          key={entry.value || '__empty__'}
          className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
        >
          <span className="font-medium text-foreground">
            {currentValueLabel(field, entry.value)}
          </span>
          <span className="font-mono font-bold text-muted-foreground">{entry.count}</span>
        </li>
      ))}
    </ul>
  );
}

export function BulkUpdatePreflightDialog({
  open,
  preview,
  loading,
  error,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  preview: CRMBulkUpdatePreview | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const canApply = Boolean(preview && !loading && !error && preview.changedCount > 0 && !busy);
  const noChanges = Boolean(preview && !loading && !error && preview.changedCount === 0);
  const missingCount = preview ? preview.selectedCount - preview.foundCount : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle>Review bulk change</DialogTitle>
          <DialogDescription>
            Nothing has changed yet. Check the current distribution and planned value before
            applying this to the selected constituents.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted/60 px-3 py-4 text-sm text-muted-foreground"
          >
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Building the summary from the selected constituents…
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700"
          >
            {error}
          </p>
        )}

        {preview && !loading && !error && (
          <div className="space-y-4">
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-border bg-surface-muted/60 px-2 py-3">
                <dt className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Selected
                </dt>
                <dd className="mt-1 text-xl font-black text-foreground">{preview.selectedCount}</dd>
              </div>
              <div className="rounded-xl border border-border bg-surface-muted/60 px-2 py-3">
                <dt className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Still exist
                </dt>
                <dd className="mt-1 text-xl font-black text-foreground">{preview.foundCount}</dd>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-2 py-3">
                <dt className="text-[10px] font-black uppercase tracking-wider text-primary">
                  Will change
                </dt>
                <dd className="mt-1 text-xl font-black text-primary">{preview.changedCount}</dd>
              </div>
            </dl>

            {preview.selectedCount !== preview.foundCount && (
              <p
                role="status"
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
              >
                {missingCount} of the selected contacts{' '}
                {missingCount === 1 ? 'no longer exists' : 'no longer exist'} and cannot be updated.
              </p>
            )}

            <section aria-labelledby="bulk-current-distribution" className="space-y-2">
              <h3
                id="bulk-current-distribution"
                className="text-xs font-black uppercase tracking-wider text-muted-foreground"
              >
                Current {FIELD_NAMES[preview.field]} distribution
              </h3>
              <DistributionList field={preview.field} entries={preview.distribution} />
            </section>

            <section
              aria-labelledby="bulk-planned-value"
              className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-3"
            >
              <h3
                id="bulk-planned-value"
                className="text-[10px] font-black uppercase tracking-wider text-primary"
              >
                Planned value
              </h3>
              <p className="mt-1 text-sm font-bold text-foreground">{plannedSentence(preview)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {noChanges
                  ? preview.field === 'tags'
                    ? 'Every selected contact already has this tag.'
                    : 'Every selected contact already has this value.'
                  : `${preview.changedCount} will change; ${preview.unchangedCount} ${
                      preview.unchangedCount === 1 ? 'already has' : 'already have'
                    } ${preview.field === 'tags' ? 'this tag' : 'this value'}.`}
              </p>
            </section>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-surface-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canApply}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-light disabled:opacity-50"
          >
            {busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
            {busy
              ? 'Applying…'
              : noChanges
                ? 'No changes to apply'
                : preview
                  ? `Apply change to ${preview.foundCount}`
                  : 'Apply change'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
