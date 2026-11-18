'use client';

import { History, Loader2 } from 'lucide-react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import type { ContentRevision } from '@/lib/actions/content';

export function RevisionsHistoryDialog({
  open,
  onOpenChange,
  dirty,
  revisionsLoading,
  revisions,
  restoreDisabled,
  onRestore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dirty: boolean;
  revisionsLoading: boolean;
  revisions: ContentRevision[];
  restoreDisabled: boolean;
  onRestore: (id: number) => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-xl bg-surface-card text-foreground p-6 rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History size={20} className="text-accent-gold" />
            <span>Page Revision History</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Restore any earlier snapshot saved to the Supabase backend.
          </DialogDescription>

          {dirty ? (
            <p
              role="status"
              className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-medium leading-relaxed text-amber-700 dark:text-amber-300"
            >
              Save or undo the current page changes before restoring a revision.
              Restoring replaces the saved row and discards unsaved work.
            </p>
          ) : null}
        </DialogHeader>

        <div className="space-y-3 my-3 max-h-[50vh] overflow-y-auto pr-1">
          {revisionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-primary" size={24} />
            </div>
          ) : revisions.length > 0 ? (
            revisions.map((rev) => (
              <div
                key={rev.id}
                className="flex items-center justify-between p-3 rounded-2xl border border-border hover:border-accent-gold/50 bg-surface-muted transition-colors gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground truncate">
                    {rev.title || 'Untitled Snapshot'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(rev.created_at).toLocaleString()} · {rev.type || 'page'} ·{' '}
                    {rev.status || 'draft'}
                  </p>
                </div>
                <ConfirmAction
                  label="Restore"
                  confirmLabel="Confirm Restore"
                  message="This will restore the page content to this snapshot and record a new append-only revision entry in Supabase."
                  onConfirm={() => onRestore(rev.id)}
                  disabled={restoreDisabled}
                  idleClassName="shrink-0 rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/20 transition-colors"
                >
                  <span>Restore</span>
                </ConfirmAction>
              </div>
            ))
          ) : (
            <p className="text-center py-6 text-xs text-muted-foreground">
              No previous revisions recorded yet for this page.
            </p>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-border"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
