'use client';

import { Activity, Loader2, Mail, PenLine, Plus, Trash2 } from 'lucide-react';
import type { FormEvent, RefObject } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { deleteCRMNote } from '@/lib/actions/crm';
import type { CRMActivity, CRMContact } from '@/types/unified';

interface CRMPanelContactTimelineProps {
  selectedContact: CRMContact | null;
  activities: CRMActivity[];
  activitiesLoading: boolean;
  activityFilter: 'all' | 'notes' | 'system';
  setActivityFilter: (filter: 'all' | 'notes' | 'system') => void;
  filteredActivities: CRMActivity[];
  notesCount: number;
  systemCount: number;
  editingNoteId: string | null;
  setEditingNoteId: (id: string | null) => void;
  editingNoteTitle: string;
  setEditingNoteTitle: (value: string) => void;
  editingNoteDesc: string;
  setEditingNoteDesc: (value: string) => void;
  handleUpdateNote: (activityId: string) => void;
  newNoteTitle: string;
  setNewNoteTitle: (value: string) => void;
  newNoteDesc: string;
  setNewNoteDesc: (value: string) => void;
  isAddingNote: boolean;
  handleAddNote: (e: FormEvent) => void;
  newNoteInputRef: RefObject<HTMLInputElement | null>;
  loadActivities: (contactId: string) => void;
}

export function CRMPanelContactTimeline({
  selectedContact,
  activities,
  activitiesLoading,
  activityFilter,
  setActivityFilter,
  filteredActivities,
  notesCount,
  systemCount,
  editingNoteId,
  setEditingNoteId,
  editingNoteTitle,
  setEditingNoteTitle,
  editingNoteDesc,
  setEditingNoteDesc,
  handleUpdateNote,
  newNoteTitle,
  setNewNoteTitle,
  newNoteDesc,
  setNewNoteDesc,
  isAddingNote,
  handleAddNote,
  newNoteInputRef,
  loadActivities,
}: CRMPanelContactTimelineProps) {
  return (
    <>
      {/* Timeline & Notes — from crm_activities with note edit/delete and event history */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-sm">Timeline & Notes</h4>
            {activities.length > 0 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActivityFilter('all')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                    activityFilter === 'all'
                      ? 'bg-primary text-white shadow-2xs'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  All ({activities.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActivityFilter('notes')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                    activityFilter === 'notes'
                      ? 'bg-primary text-white shadow-2xs'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  Notes ({notesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActivityFilter('system')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                    activityFilter === 'system'
                      ? 'bg-primary text-white shadow-2xs'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  System ({systemCount})
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingNoteId(null);
              setEditingNoteTitle('');
              setEditingNoteDesc('');
              newNoteInputRef.current?.focus();
              newNoteInputRef.current?.scrollIntoView?.({
                behavior: 'smooth',
                block: 'nearest',
              });
            }}
            className="text-xs font-bold text-primary dark:text-primary-on-dark hover:underline"
            aria-label="Add new note"
          >
            <Plus size={10} className="inline mr-0.5" /> New Note
          </button>
        </div>
        {activitiesLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : activities.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
        ) : filteredActivities.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {activityFilter === 'notes'
              ? 'No notes recorded yet.'
              : activityFilter === 'system'
                ? 'No system events recorded yet.'
                : 'No activity recorded yet.'}
          </p>
        ) : (
          <div className="space-y-3 max-h-56 overflow-y-auto overscroll-contain">
            {filteredActivities.map((act) => {
              const isNote = act.type === 'note';
              return (
                <div
                  key={act.id}
                  className="p-3 rounded-xl bg-surface-muted border border-border transition-colors hover:border-primary/20"
                >
                  {editingNoteId === act.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editingNoteTitle}
                        onChange={(e) => setEditingNoteTitle(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                        placeholder="Note title"
                      />
                      <textarea
                        value={editingNoteDesc}
                        onChange={(e) => setEditingNoteDesc(e.target.value)}
                        rows={2}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none resize-none"
                        placeholder="Note details"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                          onClick={() => setEditingNoteId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!editingNoteTitle.trim()}
                          onClick={() => handleUpdateNote(act.id)}
                          className="text-xs font-bold bg-primary text-white px-3 py-1 rounded-lg hover:bg-primary-light disabled:opacity-50 transition-colors shadow-xs"
                        >
                          Save Note
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {!isNote && (
                            <span className="shrink-0 p-1 rounded bg-background border border-border text-muted-foreground">
                              {act.type.includes('email') || act.type.includes('broadcast') ? (
                                <Mail size={11} className="text-blue-400" />
                              ) : (
                                <Activity size={11} className="text-emerald-400" />
                              )}
                            </span>
                          )}
                          <span className="text-xs font-bold text-foreground truncate">
                            {act.title || (isNote ? '(no title)' : act.type.replace(/_/g, ' '))}
                          </span>
                          {!isNote && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-muted text-muted-foreground shrink-0">
                              {act.type.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                        {isNote && (
                          <div className="flex gap-1 shrink-0">
                            <button
                              type="button"
                              className="p-1 text-[11px] text-muted-foreground hover:text-primary rounded transition-colors"
                              title="Edit note"
                              aria-label="Edit note"
                              onClick={() => {
                                setEditingNoteId(act.id);
                                setEditingNoteTitle(act.title || '');
                                setEditingNoteDesc(act.description || '');
                              }}
                            >
                              <PenLine size={12} />
                            </button>
                            <ConfirmAction
                              label="Delete Note"
                              message={`Delete note "${act.title}"?`}
                              confirmLabel="Delete"
                              danger
                              idleClassName="p-1 text-[11px] text-muted-foreground hover:text-rose-600 rounded transition-colors"
                              onConfirm={async () => {
                                const contactId = selectedContact?.id;
                                if (!contactId) return;
                                const res = await deleteCRMNote(act.id);
                                if (!res.success) {
                                  toast.error(res.error ?? 'Failed to delete note');
                                  return;
                                }
                                loadActivities(contactId);
                                toast.success('Note deleted');
                                if (res.warning) toast.warning(res.warning);
                              }}
                            >
                              <Trash2 size={12} />
                            </ConfirmAction>
                          </div>
                        )}
                      </div>
                      {act.description && (
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                          {act.description}
                        </p>
                      )}
                      {act.created_at && (
                        <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                          {new Date(act.created_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add form */}
        <form
          onSubmit={handleAddNote}
          className="mt-3 p-3 rounded-xl bg-surface-muted border border-border space-y-2"
        >
          <input
            ref={newNoteInputRef}
            type="text"
            value={newNoteTitle}
            onChange={(e) => setNewNoteTitle(e.target.value)}
            placeholder="Note title (e.g. Call summary)…"
            className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary focus:outline-none"
            required
          />
          <textarea
            value={newNoteDesc}
            onChange={(e) => setNewNoteDesc(e.target.value)}
            placeholder="Details or action items (optional)…"
            rows={2}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background resize-none focus:ring-2 focus:ring-primary focus:outline-none"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isAddingNote || !newNoteTitle.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-light disabled:opacity-50 transition-colors shadow-xs"
            >
              {isAddingNote && <Loader2 size={12} className="animate-spin" />}
              <span>Add Note</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
