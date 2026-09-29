'use client';

import { Loader2, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { toast } from 'sonner';
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
  const titleId = useId();

  const reset = () => {
    setTitle('');
    setDueAt('');
    setDetails('');
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
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black text-secondary">
          {contactName ? `New follow-up for ${contactName}` : 'New follow-up'}
        </h2>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Cancel"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div>
        <label htmlFor={titleId} className="mb-1 block text-xs font-bold text-slate-600">
          What needs doing
        </label>
        <input
          id={titleId}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          placeholder="Call the county clerk about the ballot drop box"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <div>
          <label htmlFor={`${titleId}-due`} className="mb-1 block text-xs font-bold text-slate-600">
            Due
          </label>
          <input
            id={`${titleId}-due`}
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor={`${titleId}-details`}
            className="mb-1 block text-xs font-bold text-slate-600"
          >
            Notes <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id={`${titleId}-details`}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={2000}
            placeholder="Ask for the drop box location and the deadline"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
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
        <p className="text-xs text-slate-500">
          {contactId
            ? 'Filed against this constituent.'
            : 'No constituent — visible to the whole organizing team.'}
        </p>
      </div>
    </form>
  );
}
