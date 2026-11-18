'use client';

import { AlertCircle, Clock, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { AVAILABLE_STATUSES } from './broadcast-options';

export function BroadcastConfirmationDialog({
  open,
  onOpenChange,
  recipientCount,
  subject,
  selectedStatuses,
  selectedDistricts,
  selectedTags,
  isSending,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientCount: number | null;
  subject: string;
  selectedStatuses: string[];
  selectedDistricts: string[];
  selectedTags: string[];
  isSending: boolean;
  onSend: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 sm:p-8">
        <DialogHeader>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertCircle size={24} />
          </div>
          <DialogTitle>Confirm Broadcast Dispatch</DialogTitle>
          <DialogDescription>
            You are about to send this email blast to{' '}
            <strong className="text-foreground">{recipientCount} constituents</strong> using
            Resend. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="p-3 bg-surface-muted rounded-xl text-xs space-y-1">
          <div>
            <span className="font-bold text-muted-foreground">Subject:</span> {subject}
          </div>
          <div>
            {/* `contact@…` here used to be a hardcoded literal. The real sender is
                the `RESEND_FROM_EMAIL` secret on the crm-broadcast-send function,
                which can be onboarding@resend.dev while a domain is being set up.
                An author who confirms "contact@…" deserves to know which of the two
                they are actually sending as. */}
            <span className="font-bold text-muted-foreground">Sender:</span> the chapter&apos;s
            configured Resend address — set in the Edge Function secrets, fix it there if it reads
            as onboarding or a placeholder.
          </div>
          <div>
            <span className="font-bold text-muted-foreground">Audience:</span>{' '}
            {selectedStatuses.length === 0 &&
            selectedDistricts.length === 0 &&
            selectedTags.length === 0 ? (
              'All constituents'
            ) : (
              <>
                {selectedStatuses.length > 0 &&
                  `Statuses: ${
                    AVAILABLE_STATUSES.filter((s) => selectedStatuses.includes(s.id))
                      .map((s) => s.label)
                      .join(', ') || selectedStatuses.join(', ')
                  } · `}
                {selectedDistricts.length > 0 && `Districts: ${selectedDistricts.join(', ')} · `}
                {selectedTags.length > 0 && `Tags: ${selectedTags.join(', ')} · `}
                all of them required to match
              </>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            disabled={isSending}
            onClick={() => onOpenChange(false)}
            className="flex-1 px-4 py-2.5 border border-border text-muted-foreground hover:bg-surface-muted rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSending}
            onClick={onSend}
            className="flex-1 px-4 py-2.5 bg-primary text-white hover:bg-primary-light disabled:bg-border rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-xs flex items-center justify-center gap-2"
          >
            {isSending ? (
              <>
                <Clock size={14} className="animate-spin" /> Dispatching...
              </>
            ) : (
              <>
                <Send size={14} /> Confirm &amp; Blast
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
