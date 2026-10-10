'use client';

import { GitMerge } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { type CRMContact, mergeCRMContacts } from '@/lib/actions/crm';

interface Props {
  keep: CRMContact;
  isOpen: boolean;
  onClose: () => void;
}

export function CRMMergeModal({ keep, isOpen, onClose }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState('');
  const [candidate, setCandidate] = useState<CRMContact | null>(null);
  const [results, setResults] = useState<CRMContact[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = search.trim();
    if (q.length < 3) {
      toast.error('Type at least 3 characters');
      return;
    }
    setSearching(true);
    try {
      const { getCRMContacts } = await import('@/lib/actions/crm');
      const res = await getCRMContacts({ query: q, pageSize: 8 });
      const filtered = res.contacts.filter((c) => c.id !== keep.id);
      setResults(filtered);
      if (filtered.length === 0) {
        toast.message('No other constituents matched');
      }
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const displayName = (c: CRMContact) =>
    [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email;

  const mergeMessage = (other: CRMContact) =>
    `Merge ${displayName(other)} into ${displayName(keep)}? ` +
    'The duplicate record will be removed; its timeline, tasks, tags, and giving history move to this profile. ' +
    // Consent is OR-ed by the merge (`keep.do_not_email || remove.do_not_email`), so a
    // profile that receives a merged-in opt-out can silently go dark for every future
    // broadcast. The volunteer deserves to hear that in the confirm, not discover it
    // when the next campaign skips them.
    'If either record has opted out of email, the surviving profile will be opted out too. ' +
    'This cannot be undone.';

  const handleMerge = () => {
    if (!candidate) return;
    // No confirm() here: the modal's ConfirmAction only calls this from its
    // inline confirm step, which already named both profiles and the
    // consequence. The modal itself is the first step; the dialog was the
    // redundant second question.
    startTransition(async () => {
      try {
        const res = await mergeCRMContacts({ keepId: keep.id, removeId: candidate.id });
        if (res.success) {
          toast.success('Contacts merged');
          onClose();
          router.refresh();
        } else {
          toast.error(res.error || 'Merge failed');
        }
      } catch {
        toast.error('Merge failed');
      }
    });
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg p-6 sm:p-8">
        <DialogHeader>
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary dark:text-primary-on-dark">
            Deduplicate
          </span>
          <DialogTitle id="merge-modal-title">Merge Contact</DialogTitle>
          <DialogDescription>
            Search for a duplicate constituent and fold it into this profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-surface-muted rounded-xl border border-border text-xs">
            <span className="font-black uppercase tracking-wider text-muted-foreground block mb-1">
              Keep this profile
            </span>
            <span className="font-bold text-foreground">
              {[keep.first_name, keep.last_name].filter(Boolean).join(' ') || keep.email}
            </span>{' '}
            <span className="text-muted-foreground">&lt;{keep.email}&gt;</span>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find the duplicate by name or email…"
              aria-label="Search duplicate contact"
              className="flex-1 px-4 py-2.5 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm"
            />
            <button
              type="submit"
              disabled={searching}
              className="px-4 py-2.5 bg-surface-muted hover:bg-surface-muted text-slate-700 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
            >
              {searching ? '…' : 'Search'}
            </button>
          </form>

          {results.length > 0 && (
            <ul className="max-h-48 overflow-y-auto divide-y divide-border border border-border rounded-xl">
              {results.map((c) => {
                const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email;
                const selected = candidate?.id === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setCandidate(c)}
                      aria-pressed={selected}
                      className={`w-full text-left px-4 py-3 text-xs transition-colors ${
                        selected
                          ? 'bg-primary/10 border-l-2 border-primary'
                          : 'hover:bg-surface-muted'
                      }`}
                    >
                      <span className="font-bold text-foreground block">{name}</span>
                      <span className="text-muted-foreground">{c.email}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <ConfirmAction
              label={
                candidate
                  ? `Merge ${displayName(candidate)} into ${displayName(keep)}`
                  : 'Merge Into Profile'
              }
              message={candidate ? mergeMessage(candidate) : 'Select a duplicate contact first.'}
              confirmLabel="Merge contacts"
              danger
              disabled={!candidate}
              busy={isPending}
              idleClassName="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-md transition-colors disabled:opacity-50"
              onConfirm={handleMerge}
            >
              <GitMerge size={14} aria-hidden="true" />
              {isPending ? 'Merging...' : 'Merge Into Profile'}
            </ConfirmAction>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
