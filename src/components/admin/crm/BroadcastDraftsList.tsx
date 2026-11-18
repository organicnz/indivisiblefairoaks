'use client';

import { Save, Trash2 } from 'lucide-react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import type { CRMBroadcast } from '@/types/crm';

export function BroadcastDraftsList({
  drafts,
  loadedDraftId,
  onLoadDraft,
  onDiscardDraft,
}: {
  drafts: CRMBroadcast[];
  loadedDraftId: string | null;
  onLoadDraft: (draft: CRMBroadcast) => void;
  onDiscardDraft: (id: string) => void;
}) {
  if (drafts.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Save size={16} className="text-muted-foreground" />
        <h2 className="font-display text-xs font-semibold tracking-[-0.01em] text-muted-foreground">
          Unsent drafts ({drafts.length})
        </h2>
      </div>
      <ul className="space-y-2">
        {drafts.map((draft) => {
          const loaded = draft.id === loadedDraftId;
          return (
            <li
              key={draft.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-card px-4 py-3 shadow-xs"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">
                  {draft.subject || 'Untitled draft'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Saved{' '}
                  {new Date(
                    draft.updated_at ?? draft.created_at ?? Date.now()
                  ).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ConfirmAction
                  label={`Resume draft ${draft.subject || 'untitled'}`}
                  message={`Loading “${draft.subject || 'Untitled'}” replaces whatever is in the composer now. Unsaved typing in the composer will be lost.`}
                  confirmLabel="Load draft"
                  disabled={loaded}
                  idleClassName="rounded-xl border border-border px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:border-border focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                  onConfirm={() => onLoadDraft(draft)}
                >
                  {loaded ? 'Loaded' : 'Resume'}
                </ConfirmAction>
                <ConfirmAction
                  label={`Delete draft ${draft.subject || 'untitled'}`}
                  message={`Delete the unsent draft “${draft.subject || 'Untitled'}”. Anything written in it is gone.`}
                  confirmLabel="Delete draft"
                  danger
                  idleClassName="rounded-xl px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-accent-red"
                  onConfirm={() => onDiscardDraft(draft.id)}
                >
                  <Trash2 size={14} />
                </ConfirmAction>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
