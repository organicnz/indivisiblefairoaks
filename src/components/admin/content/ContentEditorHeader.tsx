'use client';

import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Eye,
  History,
  Loader2,
  Paintbrush,
  Redo2,
  Save,
  Trash2,
  Undo2,
} from 'lucide-react';
import Link from 'next/link';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { contentComposeHref } from '@/lib/content';

interface ContentEditorHeaderProps {
  title: string;
  initialId?: number;
  slug: string;
  status: 'publish' | 'draft';
  saveState: 'idle' | 'saving' | 'saved';
  dirty: boolean;
  activeSaveFailure: boolean;
  saveFailureLabel: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSetStatus: (status: 'publish' | 'draft') => void;
  onDuplicate: () => void;
  showRevisions: boolean;
  onToggleRevisions: () => void;
  onPreview: () => void;
  onDelete: () => void;
  onSave: () => void;
  saving: boolean;
}

export function ContentEditorHeader({
  title,
  initialId,
  slug,
  status,
  saveState,
  dirty,
  activeSaveFailure,
  saveFailureLabel,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSetStatus,
  onDuplicate,
  showRevisions,
  onToggleRevisions,
  onPreview,
  onDelete,
  onSave,
  saving,
}: ContentEditorHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link
        href="/admin/content"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary dark:text-primary-on-dark transition-colors hover:text-primary-dark focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        All pages
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        {/*
          One indicator, and it never lies. Autosave writes a draft 2.5s after
          the last keystroke, so the honest report is which of those is true
          right now — including when autosave failed, which is the case that
          matters most and the one a plain "saved" tick would hide.
        */}
        {/*
          Undo and redo are buttons as well as shortcuts. A keyboard-only
          feature is a feature nobody discovers, and a discoverable one also
          tells the author whether there is anything to take back — which a
          shortcut cannot.
        */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl/Cmd+Z)"
            aria-label="Undo"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Undo2 size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl/Cmd+Shift+Z)"
            aria-label="Redo"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Redo2 size={15} aria-hidden="true" />
          </button>
        </div>

        <span
          role="status"
          aria-live="polite"
          className={`inline-flex items-center gap-1.5 text-xs ${
            activeSaveFailure
              ? 'font-semibold text-accent-red'
              : dirty || saveState === 'saving'
                ? 'font-semibold text-accent-gold'
                : 'text-muted-foreground'
          }`}
        >
          {activeSaveFailure ? (
            <>
              <AlertCircle size={13} aria-hidden="true" />
              {/* The banner is shared by the button and the autosave effect. The old
                  label named only the smaller of the two, so a failed Cmd+S read as
                  "Autosave failed" — the failure the author had just hit was mislabelled
                  as one the editor hit on its own. */}
              {saveFailureLabel}
            </>
          ) : saveState === 'saving' ? (
            <>
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : dirty ? (
            <>
              <AlertCircle size={13} aria-hidden="true" />
              Unsaved changes
            </>
          ) : (
            <>
              <Check size={13} aria-hidden="true" />
              {initialId ? 'All changes saved' : 'Not saved yet'}
            </>
          )}
        </span>
        {initialId && (
          <>
            <button
              type="button"
              onClick={() => onSetStatus(status === 'publish' ? 'draft' : 'publish')}
              className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-border focus-visible:ring-2 focus-visible:ring-primary"
            >
              {status === 'publish' ? 'Move to draft' : 'Publish'}
            </button>
            <button
              type="button"
              onClick={onDuplicate}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-border focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Copy size={15} aria-hidden="true" />
              Duplicate
            </button>
            <button
              type="button"
              onClick={onToggleRevisions}
              aria-expanded={showRevisions}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-border focus-visible:ring-2 focus-visible:ring-primary"
            >
              <History size={15} aria-hidden="true" />
              History
            </button>
            <button
              type="button"
              onClick={onPreview}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-border focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Eye size={15} aria-hidden="true" />
              Preview
            </button>
            {/*
              The canvas lives outside `/admin` so it can render the row at
              its real width with the site's own chrome. A new tab keeps this
              editor's unsaved state and its autosave loop intact.
            */}
            <Link
              href={contentComposeHref({ id: initialId, slug })}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-border focus-visible:ring-2 focus-visible:ring-primary"
              title={
                contentComposeHref({ id: initialId, slug }).startsWith('/compose/')
                  ? 'Open the full-page visual composer'
                  : 'Open the page this copy region renders into, with the region selected'
              }
            >
              <Paintbrush size={15} aria-hidden="true" />
              Compose
            </Link>
            <ConfirmAction
              label={`Delete ${title}`}
              message={`Delete “${title}”? This cannot be undone.`}
              danger
              idleClassName="rounded-xl border border-border p-2 text-accent-red transition-colors hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-primary"
              onConfirm={onDelete}
            >
              <Trash2 size={15} aria-hidden="true" />
              <span className="sr-only">Delete page</span>
            </ConfirmAction>
          </>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-dark focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : (
            <Save size={15} aria-hidden="true" />
          )}
          Save
        </button>
      </div>
    </div>
  );
}
