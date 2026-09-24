'use client';

import { GitMerge } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
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

  const handleMerge = () => {
    if (!candidate) return;
    const label =
      [candidate.first_name, candidate.last_name].filter(Boolean).join(' ') || candidate.email;
    if (
      !confirm(
        `Merge ${label} into ${[keep.first_name, keep.last_name].filter(Boolean).join(' ') || keep.email}?\n\n` +
          'The duplicate record will be removed; its timeline, tasks, tags, and giving history move to this profile. This cannot be undone.'
      )
    ) {
      return;
    }
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
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">
            Deduplicate
          </span>
          <DialogTitle id="merge-modal-title">Merge Contact</DialogTitle>
          <DialogDescription>
            Search for a duplicate constituent and fold it into this profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
            <span className="font-black uppercase tracking-wider text-slate-400 block mb-1">
              Keep this profile
            </span>
            <span className="font-bold text-secondary">
              {[keep.first_name, keep.last_name].filter(Boolean).join(' ') || keep.email}
            </span>{' '}
            <span className="text-slate-400">&lt;{keep.email}&gt;</span>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find the duplicate by name or email…"
              aria-label="Search duplicate contact"
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-sm"
            />
            <button
              type="submit"
              disabled={searching}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
            >
              {searching ? '…' : 'Search'}
            </button>
          </form>

          {results.length > 0 && (
            <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
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
                        selected ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-bold text-secondary block">{name}</span>
                      <span className="text-slate-400">{c.email}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleMerge}
              disabled={!candidate || isPending}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-md transition-colors disabled:opacity-50"
            >
              <GitMerge size={14} />
              {isPending ? 'Merging...' : 'Merge Into Profile'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
