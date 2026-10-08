'use client';

import { CalendarCheck, CheckCircle2, Circle, Edit2, Loader2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { CRMPager } from '@/components/admin/crm/CRMPager';
import { CRMTaskForm } from '@/components/admin/crm/CRMTaskForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import {
  type CRMTaskWithContact,
  deleteCRMTask,
  setCRMTaskStatus,
  updateCRMTask,
} from '@/lib/actions/crm';

interface Props {
  tasks: CRMTaskWithContact[];
  scope: string;
  page: number;
  pageSize: number;
  totalCount: number;
}

const SCOPES = [
  { id: 'open', label: 'Open' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'done', label: 'Completed' },
  { id: 'all', label: 'All' },
];

function dueLabel(dueAt: string | null): { text: string; className: string } {
  if (!dueAt) return { text: 'No due date', className: 'text-slate-400' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueAt}T00:00:00`);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) {
    return {
      text: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      className: 'text-red-600 font-black',
    };
  }
  if (diffDays === 0) return { text: 'Today', className: 'text-amber-600 font-black' };
  if (diffDays === 1) return { text: 'Tomorrow', className: 'text-amber-700 font-bold' };
  return {
    text: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    className: 'text-slate-500',
  };
}

export function CRMTasksClient({ tasks, scope, page, pageSize, totalCount }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Edit task state
  const [editingTask, setEditingTask] = useState<CRMTaskWithContact | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [editDueAt, setEditDueAt] = useState('');
  const [editStatus, setEditStatus] = useState<'open' | 'done'>('open');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleStartEdit = (task: CRMTaskWithContact) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDetails(task.details || '');
    setEditDueAt(task.due_at || '');
    setEditStatus(task.status === 'done' ? 'done' : 'open');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editTitle.trim()) {
      toast.error('Task title is required');
      return;
    }
    setIsSavingEdit(true);
    try {
      const res = await updateCRMTask({
        id: editingTask.id,
        title: editTitle.trim(),
        details: editDetails.trim() || null,
        dueAt: editDueAt || null,
        status: editStatus,
      });
      if (res.success) {
        toast.success('Follow-up updated');
        setEditingTask(null);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update follow-up');
      }
    } catch {
      toast.error('Failed to update follow-up');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const navigateScope = (next: string) => {
    startTransition(() => {
      router.push(next === 'open' ? '/admin/crm/tasks' : `/admin/crm/tasks?scope=${next}`);
    });
  };

  const handleToggle = async (task: CRMTaskWithContact) => {
    setBusyId(task.id);
    try {
      const next = task.status === 'done' ? 'open' : 'done';
      const res = await setCRMTaskStatus({ id: task.id, status: next });
      if (res.success) {
        toast.success(next === 'done' ? 'Follow-up completed' : 'Follow-up reopened');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update follow-up');
      }
    } catch {
      toast.error('Failed to update follow-up');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (task: CRMTaskWithContact) => {
    // No confirm() here: the row's ConfirmAction only calls this from its
    // inline confirm step.
    setBusyId(task.id);
    try {
      const res = await deleteCRMTask(task.id);
      if (res.success) {
        toast.success('Follow-up deleted');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete follow-up');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Scope pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => navigateScope(s.id)}
            disabled={isPending}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              scope === s.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Adding a follow-up is here, not only on a constituent's profile. */}
      <CRMTaskForm />

      {/* Task list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {tasks.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <CalendarCheck size={32} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold text-sm">No follow-ups in this view.</p>
            <p className="text-xs mt-1">
              Add one above — with a constituent, or as chapter-wide work.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tasks.map((task) => {
              const due = dueLabel(task.due_at);
              const done = task.status === 'done';
              const contactName =
                task.contact &&
                [task.contact.first_name, task.contact.last_name].filter(Boolean).join(' ');

              return (
                <li
                  key={task.id}
                  className={`flex items-start gap-3 px-5 py-4 hover:bg-slate-50/80 transition-colors ${
                    done ? 'opacity-60' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleToggle(task)}
                    disabled={busyId === task.id}
                    className="mt-0.5 p-1 text-slate-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
                    title={done ? 'Reopen' : 'Mark complete'}
                    aria-label={done ? 'Reopen follow-up' : 'Mark follow-up complete'}
                  >
                    {done ? (
                      <CheckCircle2 size={18} className="text-emerald-500" />
                    ) : (
                      <Circle size={18} />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-sm font-bold text-secondary ${done ? 'line-through' : ''}`}
                    >
                      {task.title}
                    </div>
                    {task.details && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{task.details}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                      {task.contact ? (
                        <Link
                          href={`/admin/crm/${task.contact.id}`}
                          className="text-primary font-bold hover:underline truncate max-w-[200px]"
                        >
                          {contactName || task.contact.email}
                        </Link>
                      ) : (
                        // Not a gap in the data: this is chapter work, and
                        // saying so is more useful than showing no name at all.
                        <span className="font-bold text-slate-500">Chapter-wide</span>
                      )}
                      <span className={due.className}>{due.text}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(task)}
                      className="p-1.5 text-slate-300 hover:text-primary rounded-lg hover:bg-slate-100 transition-colors"
                      title="Edit follow-up"
                      aria-label={`Edit follow-up ${task.title}`}
                    >
                      <Edit2 size={14} aria-hidden="true" />
                    </button>
                    <ConfirmAction
                      label={`Delete follow-up ${task.title}`}
                      message={`Delete follow-up "${task.title}"?`}
                      danger
                      busy={busyId === task.id}
                      idleClassName="p-1.5 text-slate-300 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                      onConfirm={() => void handleDelete(task)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </ConfirmAction>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <CRMPager
        page={page}
        totalCount={totalCount}
        pageSize={pageSize}
        basePath="/admin/crm/tasks"
        params={scope === 'open' ? new URLSearchParams() : new URLSearchParams({ scope })}
      />

      {/* Edit Follow-up Modal Dialog */}
      <Dialog open={Boolean(editingTask)} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-secondary">
              Edit Follow-up
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Update commitment details, due date, or task status.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
            <div>
              <label
                htmlFor="edit-task-title"
                className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
              >
                Task *
              </label>
              <input
                id="edit-task-title"
                type="text"
                required
                maxLength={200}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="e.g. Call regarding Saturday rally"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-bold text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            <div>
              <label
                htmlFor="edit-task-details"
                className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
              >
                Details
              </label>
              <textarea
                id="edit-task-details"
                rows={3}
                value={editDetails}
                onChange={(e) => setEditDetails(e.target.value)}
                placeholder="Context, background or notes…"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="edit-task-due"
                  className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
                >
                  Due Date
                </label>
                <input
                  id="edit-task-due"
                  type="date"
                  value={editDueAt}
                  onChange={(e) => setEditDueAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-task-status"
                  className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
                >
                  Status
                </label>
                <select
                  id="edit-task-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'open' | 'done')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="open">Open (In Progress)</option>
                  <option value="done">Completed</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-primary text-white hover:bg-primary-light text-xs font-black uppercase tracking-widest rounded-xl transition-colors shadow-xs disabled:opacity-50"
              >
                {isSavingEdit ? <Loader2 size={14} className="animate-spin" /> : null}
                Save Changes
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
