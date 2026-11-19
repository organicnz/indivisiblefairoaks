'use client';

import { Loader2, RefreshCw, Save, Send, Trash2 } from 'lucide-react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { BROADCAST_RECIPIENT_CEILING } from '@/lib/crm-broadcast';
import type { BroadcastProgress } from '@/types/crm';

interface BroadcastDispatchBarProps {
  recipientCount: number | null;
  excludedCount: number;
  countFailed: boolean;
  overCeiling: boolean;
  segmentConsentMismatch: string | null;
  draftId: string | null;
  handleDiscardDraft: (id: string) => void;
  handleSaveDraft: () => void;
  savingDraft: boolean;
  subject: string;
  body: string;
  setIsConfirmOpen: (open: boolean) => void;
  progress: BroadcastProgress | null;
  handleResumeProgress: () => void;
}

export function BroadcastDispatchBar({
  recipientCount,
  excludedCount,
  countFailed,
  overCeiling,
  segmentConsentMismatch,
  draftId,
  handleDiscardDraft,
  handleSaveDraft,
  savingDraft,
  subject,
  body,
  setIsConfirmOpen,
  progress,
  handleResumeProgress,
}: BroadcastDispatchBarProps) {
  return (
    <>
      {/* Dispatch Action Bar */}
      <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          Will be delivered to <strong className="text-foreground">{recipientCount ?? 0}</strong>{' '}
          constituents.
          <span className="block text-[11px] text-muted-foreground mt-0.5">
            {excludedCount > 0 ? (
              <>
                {excludedCount.toLocaleString()} matching{' '}
                {excludedCount === 1 ? 'contact is' : 'contacts are'} opted out and excluded.
                {recipientCount === 0
                  ? ' Nobody on this list will receive it.'
                  : ' Every email includes a one-click unsubscribe link.'}
              </>
            ) : (
              <>
                Opted-out contacts are excluded automatically. Every email includes a one-click
                unsubscribe link.
              </>
            )}
          </span>
          {countFailed && (
            <span role="alert" className="mt-1 block font-bold text-accent-red">
              The audience could not be counted, so Send is withheld until it can be. Change a
              filter to try again.
            </span>
          )}
          {overCeiling && (
            <span role="alert" className="mt-1 block font-bold text-accent-red">
              This is over the {BROADCAST_RECIPIENT_CEILING.toLocaleString()}-recipient limit for a
              single broadcast. Narrow the audience before sending.
            </span>
          )}
          {segmentConsentMismatch && (
            <span role="alert" className="mt-1 block font-bold text-accent-red">
              {segmentConsentMismatch} Change any audience filter above to confirm you have reviewed
              it — Send stays withheld until then.
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {draftId ? (
            <ConfirmAction
              label="Discard draft"
              message="Delete this unsent draft. Anything written in it is gone."
              confirmLabel="Delete draft"
              danger
              idleClassName="inline-flex items-center gap-1.5 px-4 py-2.5 text-muted-foreground hover:text-accent-red text-xs font-black uppercase tracking-wider rounded-xl transition-colors"
              onConfirm={() => {
                if (draftId) void handleDiscardDraft(draftId);
              }}
            >
              <Trash2 size={14} /> Discard draft
            </ConfirmAction>
          ) : (
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={savingDraft || !subject.trim() || !body.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-border text-foreground hover:border-border disabled:opacity-50 text-xs font-black uppercase tracking-wider rounded-xl transition-colors"
            >
              {savingDraft ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save draft
            </button>
          )}
          <button
            type="button"
            disabled={
              !subject.trim() ||
              !body.trim() ||
              !recipientCount ||
              recipientCount === 0 ||
              overCeiling ||
              segmentConsentMismatch !== null
            }
            onClick={() => setIsConfirmOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white hover:bg-primary-light disabled:bg-surface-muted disabled:text-muted-foreground text-xs font-black uppercase tracking-wider rounded-xl transition-colors shadow-xs"
          >
            <Send size={14} /> Send Broadcast Now
          </button>
        </div>
      </div>

      {/*
        Live progress. The send no longer runs inside the request that
        started it, so without this the button would return and the admin
        would have no idea whether anything was going out.

        Two states, not one. "Sending" is a claim about the database. Once
        the poll gives up — a 5,000-recipient campaign is five hundred
        round-trips in the sender — the number here stops moving while the
        send carries on, so continuing to say "Sending" is a lie about
        this view. The second branch says plainly that the send may well be
        fine and that this tab has stopped watching, and offers the refresh
        rather than leaving the operator to guess which kind of stuck it is.
      */}
      {progress && (progress.status === 'queued' || progress.status === 'sending') && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-xl border px-4 py-3 ${
            progress.stillWatching
              ? 'border-blue-200 bg-blue-50'
              : 'border-accent-gold/40 bg-surface-muted'
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              progress.stillWatching ? 'text-blue-900' : 'text-foreground'
            }`}
          >
            {progress.stillWatching ? (
              <>
                Sending “{progress.subject}” — {progress.sentCount} of {progress.recipientCount}{' '}
                accepted
              </>
            ) : (
              <>Still sending, but this view has stopped updating</>
            )}
          </p>
          {!progress.stillWatching && (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                {progress.sentCount} of {progress.recipientCount} accepted as of the last check. The
                send continues in the background — it is not stuck. Resume updates here, or refresh
                the page, to pick it up again.
              </p>
              <button
                type="button"
                onClick={handleResumeProgress}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-card px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary"
              >
                <RefreshCw size={14} />
                Resume updates
              </button>
            </>
          )}
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-blue-200">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-sensory"
              style={{
                width: `${
                  progress.recipientCount > 0
                    ? Math.min(100, (progress.sentCount / progress.recipientCount) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
          {progress.failedCount > 0 && (
            <p className="mt-2 text-xs text-blue-800">
              {progress.failedCount} rejected by the provider.
            </p>
          )}
          {(progress.suppressedCount ?? 0) > 0 && (
            <p className="mt-2 text-xs text-amber-800">
              {progress.suppressedCount} suppressed by the provider and not counted as accepted.
            </p>
          )}
        </div>
      )}
    </>
  );
}
