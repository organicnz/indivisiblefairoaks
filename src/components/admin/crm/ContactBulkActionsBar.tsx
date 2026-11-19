'use client';

import { Trash2 } from 'lucide-react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import {
  CRM_CONTACT_BULK_CONSENT_OPTIONS,
  CRM_CONTACT_BULK_STATUS_OPTIONS,
} from '@/lib/crm-contact-options';
import type { ConsentDecision, CRMContactStatus } from '@/types/crm';

export function ContactBulkActionsBar({
  count,
  busy,
  tagInput,
  districtInput,
  onClear,
  onTagInputChange,
  onDistrictInputChange,
  onBulkStatus,
  onBulkAddTag,
  onBulkDistrict,
  onBulkConsent,
  onBulkDelete,
}: {
  count: number;
  busy: boolean;
  tagInput: string;
  districtInput: string;
  onClear: () => void;
  onTagInputChange: (value: string) => void;
  onDistrictInputChange: (value: string) => void;
  onBulkStatus: (status: CRMContactStatus) => void;
  onBulkAddTag: () => void;
  onBulkDistrict: () => void;
  onBulkConsent: (consent: ConsentDecision) => void;
  onBulkDelete: () => void;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-secondary text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex flex-wrap items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
        <span className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-black">
          {count}
        </span>
        <span className="text-xs font-bold whitespace-nowrap">Selected</span>
        <button
          type="button"
          onClick={() => onClear()}
          className="text-xs text-muted-foreground hover:text-white underline ml-1"
        >
          Clear
        </button>
      </div>

      {/* Bulk Status Select */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
          Status:
        </span>
        <select
          disabled={busy}
          aria-label="Change status for selected constituents"
          onChange={(e) => {
            if (e.target.value) {
              onBulkStatus(e.target.value as CRMContactStatus);
              e.target.value = '';
            }
          }}
          defaultValue=""
          className="bg-slate-800 text-white text-xs font-bold rounded-lg px-2.5 py-1.5 border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
        >
          <option value="" disabled>
            Change Status…
          </option>
          {CRM_CONTACT_BULK_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk Add Tag */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          placeholder="+ Add Tag…"
          value={tagInput}
          disabled={busy}
          onChange={(e) => onTagInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onBulkAddTag();
            }
          }}
          className="bg-slate-800 text-white placeholder-slate-400 text-xs rounded-lg px-2.5 py-1.5 border border-slate-700 w-28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void onBulkAddTag()}
          disabled={!tagInput.trim() || busy}
          className="px-2.5 py-1.5 bg-primary hover:bg-primary-light text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {/* Bulk District */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          placeholder="District…"
          value={districtInput}
          disabled={busy}
          onChange={(e) => onDistrictInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onBulkDistrict();
            }
          }}
          className="bg-slate-800 text-white placeholder-slate-400 text-xs rounded-lg px-2.5 py-1.5 border border-slate-700 w-24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void onBulkDistrict()}
          disabled={!districtInput.trim() || busy}
          className="px-2.5 py-1.5 bg-primary hover:bg-primary-light text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-40"
        >
          Set
        </button>
      </div>

      {/* Bulk Consent */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
          Email:
        </span>
        <select
          disabled={busy}
          onChange={(e) => {
            if (e.target.value) {
              onBulkConsent(e.target.value as ConsentDecision);
              e.target.value = '';
            }
          }}
          defaultValue=""
          aria-label="Change email consent for selected constituents"
          className="bg-slate-800 text-white text-xs font-bold rounded-lg px-2.5 py-1.5 border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
        >
          <option value="" disabled>
            Consent…
          </option>
          {CRM_CONTACT_BULK_CONSENT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.bulkLabel}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk Delete */}
      <div className="pl-2 border-r border-slate-700 sm:border-r-0 sm:border-l">
        <ConfirmAction
          label={`Delete ${count} constituents`}
          message={`Delete ${count} selected constituents? This will remove all associated notes, tasks, and history permanently.`}
          confirmLabel="Delete Selected"
          danger
          busy={busy}
          idleClassName="px-3 py-1.5 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
          onConfirm={() => onBulkDelete()}
        >
          <Trash2 size={13} />
          Delete ({count})
        </ConfirmAction>
      </div>
    </div>
  );
}
