'use client';

import {
  Check,
  Edit2,
  FileText,
  GitMerge,
  Loader2,
  Mail,
  MessageSquare,
  ShoppingBag,
  Trash2,
  User,
} from 'lucide-react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import type { CRMActivity } from '@/types/crm';

interface CRMContactTimelineTabProps {
  activities: CRMActivity[];
  activitiesTruncated: boolean;
  activityCount: number;
  editingNoteId: string | null;
  setEditingNoteId: (id: string | null) => void;
  editingNoteTitle: string;
  setEditingNoteTitle: (value: string) => void;
  editingNoteDesc: string;
  setEditingNoteDesc: (value: string) => void;
  updatingNote: boolean;
  handleUpdateNote: (activityId: string) => void;
  handleStartEditNote: (activity: CRMActivity) => void;
  handleDeleteNote: (activityId: string) => void;
}

export function CRMContactTimelineTab({
  activities,
  activitiesTruncated,
  activityCount,
  editingNoteId,
  setEditingNoteId,
  editingNoteTitle,
  setEditingNoteTitle,
  editingNoteDesc,
  setEditingNoteDesc,
  updatingNote,
  handleUpdateNote,
  handleStartEditNote,
  handleDeleteNote,
}: CRMContactTimelineTabProps) {
  return (
      <div className="bg-surface-card rounded-2xl border border-border shadow-xs p-6">
        <h2 className="mb-6 font-display text-xs font-semibold tracking-[-0.01em] text-muted-foreground">
          Interaction history &amp; civic record
        </h2>

        {/*
          The count is the *total*, not the rows on screen. The tab said
          "Timeline (50)" against 5,000 activities and read as a complete
          history; the read behind it was unbounded, so a recipient of one
          chapter-wide broadcast loaded every one of those 5,000 rows and
          rendered all of them. Now the query is capped, and the tab states
          what is not being shown — a silently short list presented as a
          whole one is worse than an obviously long one.
        */}
        {activities.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-xs">
            No recorded activities yet for this constituent.
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-muted">
            {activities.map((act) => {
              let icon = <FileText size={12} />;
              let badgeClass = 'bg-surface-muted text-foreground';

              if (act.type === 'email_sent') {
                icon = <Mail size={12} />;
                badgeClass = 'bg-blue-100 text-blue-800';
              } else if (act.type === 'order') {
                icon = <ShoppingBag size={12} />;
                badgeClass = 'bg-emerald-100 text-emerald-800';
              } else if (act.type === 'contact_form') {
                icon = <MessageSquare size={12} />;
                badgeClass = 'bg-amber-100 text-amber-800';
              } else if (act.type === 'status_change') {
                icon = <User size={12} />;
                badgeClass = 'bg-purple-100 text-purple-800';
              } else if (act.type === 'import') {
                icon = <FileText size={12} />;
                badgeClass = 'bg-cyan-100 text-cyan-800';
              } else if (act.type === 'merge') {
                icon = <GitMerge size={12} />;
                badgeClass = 'bg-rose-100 text-rose-800';
              }

              return (
                <div key={act.id} className="relative group">
                  <span className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-surface-card border-2 border-primary flex items-center justify-center text-[8px]" />
                  <div className="p-4 rounded-xl bg-surface-muted/70 border border-border hover:border-border transition-colors space-y-2">
                    {editingNoteId === act.id ? (
                      <div className="space-y-3">
                        <div className="text-xs font-bold text-foreground flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span className={`p-1 rounded-md ${badgeClass}`}>{icon}</span>
                            Edit Note
                          </span>
                        </div>
                        <input
                          type="text"
                          value={editingNoteTitle}
                          onChange={(e) => setEditingNoteTitle(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          placeholder="Note title"
                        />
                        <textarea
                          value={editingNoteDesc}
                          onChange={(e) => setEditingNoteDesc(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          placeholder="Note details…"
                        />
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingNoteId(null)}
                            className="px-2.5 py-1 text-xs font-bold text-muted-foreground hover:bg-surface-muted rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={updatingNote}
                            onClick={() => void handleUpdateNote(act.id)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-light transition-colors disabled:opacity-50"
                          >
                            {updatingNote ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Check size={12} />
                            )}
                            Save Note
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-foreground flex items-center gap-1.5">
                            <span className={`p-1 rounded-md ${badgeClass}`}>{icon}</span>
                            {act.title}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(act.created_at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                              })}
                            </span>
                            {act.type === 'note' && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditNote(act)}
                                  className="p-1 text-muted-foreground hover:text-primary dark:hover:text-primary-on-dark hover:bg-surface-card rounded transition-colors"
                                  title="Edit note"
                                  aria-label={`Edit note: ${act.title}`}
                                >
                                  <Edit2 size={12} />
                                </button>
                                <ConfirmAction
                                  label="Delete Note"
                                  message={`Delete note "${act.title}"? This cannot be undone.`}
                                  confirmLabel="Delete Note"
                                  danger
                                  idleClassName="p-1 text-muted-foreground hover:text-rose-600 hover:bg-surface-card rounded transition-colors"
                                  onConfirm={() => void handleDeleteNote(act.id)}
                                >
                                  <Trash2 size={12} />
                                </ConfirmAction>
                              </div>
                            )}
                          </div>
                        </div>
                        {act.description && (
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap pl-6 pt-1 leading-relaxed">
                            {act.description}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activitiesTruncated && (
          <p
            role="status"
            className="mt-6 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-900"
          >
            Showing the {activities.length} most recent of {activityCount} recorded activities.
            Older entries are still stored — a campaign blast to this constituent accounts for
            most of them.
          </p>
        )}
      </div>
  );
}
