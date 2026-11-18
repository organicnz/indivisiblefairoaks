'use client';

import { Download, Mail, Plus, RefreshCw, Upload } from 'lucide-react';
import Link from 'next/link';

type CRMContactActionBarProps = {
  exporting: boolean;
  syncing: boolean;
  totalCount: number;
  onExport: () => void;
  onImport: () => void;
  onSync: () => void;
  onAdd: () => void;
};

export function CRMContactActionBar({
  exporting,
  syncing,
  totalCount,
  onExport,
  onImport,
  onSync,
  onAdd,
}: CRMContactActionBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-border text-xs">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onExport}
          disabled={exporting || !totalCount}
          title="Export ALL filtered constituents to CSV (not just this page)"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-muted hover:bg-surface-muted text-foreground rounded-xl font-bold transition-colors disabled:opacity-50"
        >
          <Download size={13} />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>

        <button
          type="button"
          onClick={onImport}
          title="Import constituents from CSV (existing emails are skipped)"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-muted hover:bg-surface-muted text-foreground rounded-xl font-bold transition-colors"
        >
          <Upload size={13} />
          Import CSV
        </button>

        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          title="Sync historical contacts from contact_submissions & profiles"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-muted hover:bg-surface-muted text-foreground rounded-xl font-bold transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync History'}
        </button>

        <Link
          href="/admin/crm/broadcasts"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl font-bold transition-colors"
        >
          <Mail size={13} />
          New Broadcast Blast
        </Link>

        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white hover:bg-primary-light rounded-xl font-bold transition-colors shadow-xs"
        >
          <Plus size={14} />
          Add Constituent
        </button>
      </div>
    </div>
  );
}
