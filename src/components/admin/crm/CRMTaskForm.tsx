'use client';

import { ImageIcon, Loader2, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { CRMMediaLibraryModal } from '@/components/admin/crm/composer/CRMMediaLibraryModal';
import { addCRMTask } from '@/lib/actions/crm';

interface Props {
  /** Fixed when the task belongs to a constituent; omitted on the board. */
  contactId?: string;
  contactName?: string;
  onDone?: () => void;
}

/**
 * Creating a follow-up used to be reachable only from a constituent's profile,
 * which meant the board could only ever show work someone had already filed
 * against a person. The tasks a chapter actually runs — call the clerk, confirm
 * the venue, chase the AV rental — belong to nobody, so the form takes an
 * optional contact and the board is a first-class place to add one.
 *
 * Deliberately inline rather than a modal: it is one text field in the common
 * case, and a dialog for that is a click the author does not need to make.
 */
export function CRMTaskForm({ contactId, contactName, onDone }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const titleId = useId();

  const reset = () => {
    setTitle('');
    setDueAt('');
    setDetails('');
    setIsMediaModalOpen(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await addCRMTask({
        contactId: contactId ?? null,
        title,
        details: details || null,
        dueAt: dueAt || null,
      });
      if (res.success) {
        toast.success('Follow-up added');
        reset();
        setOpen(false);
        onDone?.();
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to add follow-up');
      }
    } catch {
      toast.error('Failed to add follow-up');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-dark focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <Plus size={16} aria-hidden="true" />
        Add follow-up
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-border bg-surface-card p-4 shadow-xs space-y-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black text-foreground">
          {contactName ? `New follow-up for ${contactName}` : 'New follow-up'}
        </h2>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-slate-700"
          aria-label="Cancel"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div>
        <label htmlFor={titleId} className="mb-1 block text-xs font-bold text-muted-foreground">
          What needs doing
        </label>
        <input
          id={titleId}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          placeholder="Call the county clerk about the ballot drop box"
          className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <div>
          <label
            htmlFor={`${titleId}-due`}
            className="mb-1 block text-xs font-bold text-muted-foreground"
          >
            Due
          </label>
          <input
            id={`${titleId}-due`}
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor={`${titleId}-details`}
              className="block text-xs font-bold text-muted-foreground"
            >
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <button
              type="button"
              onClick={() => setIsMediaModalOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-primary dark:text-primary-on-dark hover:underline"
            >
              <ImageIcon size={11} /> Media
            </button>
          </div>
          <input
            id={`${titleId}-details`}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={2000}
            placeholder="Ask for the drop box location and the deadline"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          Add follow-up
        </button>
        <p className="text-xs text-muted-foreground">
          {contactId
            ? 'Filed against this constituent.'
            : 'No constituent — visible to the whole organizing team.'}
        </p>
      </div>

      {isMediaModalOpen && (
        <CRMMediaLibraryModal
          isOpen={isMediaModalOpen}
          onClose={() => setIsMediaModalOpen(false)}
          onSelectMedia={(media) => {
            const alt = media.alt || media.name;
            setDetails((prev) => `${prev ? `${prev} ` : ''}![${alt}](${media.url})`);
            toast.success('Media reference inserted into task notes');
            setIsMediaModalOpen(false);
          }}
          initialFolder="crm"
        />
      )}
    </form>
  );
}
