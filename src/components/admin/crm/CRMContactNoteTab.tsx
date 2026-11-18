'use client';

import { Image as ImageIcon, Plus } from 'lucide-react';
import type { FormEvent } from 'react';

interface CRMContactNoteTabProps {
  noteTitle: string;
  setNoteTitle: (value: string) => void;
  noteDesc: string;
  setNoteDesc: (value: string) => void;
  savingNote: boolean;
  handleAddNote: (e: FormEvent) => void;
  setIsMediaModalOpen: (open: boolean) => void;
}

export function CRMContactNoteTab({
  noteTitle,
  setNoteTitle,
  noteDesc,
  setNoteDesc,
  savingNote,
  handleAddNote,
  setIsMediaModalOpen,
}: CRMContactNoteTabProps) {
  return (
      <div className="bg-surface-card rounded-2xl border border-border shadow-xs p-6 space-y-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary dark:text-primary-on-dark">
            Organizer Observations
          </span>
          <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
            Log meeting note or engagement activity
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Record organizing interactions, volunteer commitments, or conversations.
          </p>
        </div>

        <form onSubmit={handleAddNote} className="space-y-4">
          <div>
            <label
              htmlFor="note-title"
              className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1"
            >
              Activity Title / Summary *
            </label>
            <input
              id="note-title"
              type="text"
              required
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="e.g. Spoke at General Meeting about choir rehearsals"
              className="w-full px-4 py-2.5 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="note-desc"
                className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground"
              >
                Detailed Notes & Action Items
              </label>
              <button
                type="button"
                onClick={() => setIsMediaModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-primary dark:text-primary-on-dark hover:bg-primary/10 rounded-lg transition-colors"
              >
                <ImageIcon size={13} /> Attach Storage Media
              </button>
            </div>
            <textarea
              id="note-desc"
              rows={5}
              value={noteDesc}
              onChange={(e) => setNoteDesc(e.target.value)}
              placeholder="Details of the conversation, follow-up dates, volunteer availability..."
              className="w-full px-4 py-2.5 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm leading-relaxed"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingNote}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white hover:bg-primary-light text-xs font-black uppercase tracking-widest rounded-xl transition-colors shadow-md disabled:opacity-50"
            >
              <Plus size={14} />
              {savingNote ? 'Recording...' : 'Save Note'}
            </button>
          </div>
        </form>
      </div>
  );
}
