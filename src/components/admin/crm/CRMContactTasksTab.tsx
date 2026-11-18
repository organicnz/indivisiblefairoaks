'use client';

import {
  Check,
  CheckCircle2,
  Edit2,
  FileText,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import type { FormEvent } from 'react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import type { CRMTask } from '@/types/crm';

interface CRMContactTasksTabProps {
  tasks: CRMTask[];
  tasksTruncated: boolean;
  taskCount: number;
  taskTitle: string;
  setTaskTitle: (value: string) => void;
  taskDetails: string;
  setTaskDetails: (value: string) => void;
  taskDue: string;
  setTaskDue: (value: string) => void;
  savingTask: boolean;
  handleAddTask: (e: FormEvent) => void;
  editingTaskId: string | null;
  setEditingTaskId: (id: string | null) => void;
  editingTaskTitle: string;
  setEditingTaskTitle: (value: string) => void;
  editingTaskDetails: string;
  setEditingTaskDetails: (value: string) => void;
  editingTaskDue: string;
  setEditingTaskDue: (value: string) => void;
  updatingTask: boolean;
  handleUpdateTask: (taskId: string) => void;
  handleStartEditTask: (task: CRMTask) => void;
  togglingTaskId: string | null;
  handleTaskToggle: (task: CRMTask) => void;
  handleDeleteTask: (taskId: string) => void;
}

export function CRMContactTasksTab({
  tasks,
  tasksTruncated,
  taskCount,
  taskTitle,
  setTaskTitle,
  taskDetails,
  setTaskDetails,
  taskDue,
  setTaskDue,
  savingTask,
  handleAddTask,
  editingTaskId,
  setEditingTaskId,
  editingTaskTitle,
  setEditingTaskTitle,
  editingTaskDetails,
  setEditingTaskDetails,
  editingTaskDue,
  setEditingTaskDue,
  updatingTask,
  handleUpdateTask,
  handleStartEditTask,
  togglingTaskId,
  handleTaskToggle,
  handleDeleteTask,
}: CRMContactTasksTabProps) {
  return (
      <div className="bg-surface-card rounded-2xl border border-border shadow-xs p-6 space-y-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary dark:text-primary-on-dark">
            Organizer Follow-ups
          </span>
          <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
            Schedule &amp; track tasks
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Due-dated commitments for this constituent.{' '}
            <Link
              href="/admin/crm/tasks"
              className="text-primary dark:text-primary-on-dark font-bold hover:underline"
            >
              Open the full board →
            </Link>
          </p>
        </div>

        <form onSubmit={handleAddTask} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="task-title"
                className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1"
              >
                Task *
              </label>
              <input
                id="task-title"
                type="text"
                required
                maxLength={200}
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g. Call about Saturday canvass"
                className="w-full px-4 py-2.5 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="task-due"
                className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1"
              >
                Due date
              </label>
              <input
                id="task-due"
                type="date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="task-details"
              className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1"
            >
              Details
            </label>
            <textarea
              id="task-details"
              rows={2}
              value={taskDetails}
              onChange={(e) => setTaskDetails(e.target.value)}
              placeholder="Context, phone number, promised deliverable…"
              className="w-full px-4 py-2.5 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingTask}
              className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-white hover:bg-primary-light text-xs font-black uppercase tracking-widest rounded-xl transition-colors shadow-xs disabled:opacity-50"
            >
              <Plus size={14} />
              {savingTask ? 'Saving…' : 'Add Follow-up'}
            </button>
          </div>
        </form>

        {tasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs border-t border-border">
            No follow-ups yet.
          </div>
        ) : (
          <>
            {tasksTruncated && (
              <p
                role="status"
                className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-900"
              >
                Showing {tasks.length} of {taskCount} recorded follow-ups. Older entries are still
                stored — manage the full list on the tasks board.
              </p>
            )}
            <ul className="divide-y divide-border border-t border-border">
              {tasks.map((task) => (
                <li key={task.id} className="py-3">
                  {editingTaskId === task.id ? (
                    <div className="p-3 bg-surface-muted rounded-xl border border-border space-y-3">
                      <div className="text-xs font-bold text-foreground flex items-center justify-between">
                        <span>Edit Follow-up</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ID: {task.id.slice(0, 8)}
                        </span>
                      </div>
                      <label className="block text-[10px] font-black uppercase text-muted-foreground">
                        <span className="block mb-1">Task Title *</span>
                        <input
                          type="text"
                          value={editingTaskTitle}
                          onChange={(e) => setEditingTaskTitle(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                          placeholder="Task title"
                        />
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block text-[10px] font-black uppercase text-muted-foreground">
                          <span className="block mb-1">Details</span>
                          <input
                            type="text"
                            value={editingTaskDetails}
                            onChange={(e) => setEditingTaskDetails(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                            placeholder="Context or notes"
                          />
                        </label>
                        <label className="block text-[10px] font-black uppercase text-muted-foreground">
                          <span className="block mb-1">Due Date</span>
                          <input
                            type="date"
                            value={editingTaskDue}
                            onChange={(e) => setEditingTaskDue(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                          />
                        </label>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingTaskId(null)}
                          className="px-2.5 py-1 text-xs font-bold text-muted-foreground hover:bg-surface-muted rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={updatingTask}
                          onClick={() => void handleUpdateTask(task.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-light transition-colors disabled:opacity-50"
                        >
                          {updatingTask ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Check size={12} />
                          )}
                          Save Task
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 group">
                      <button
                        type="button"
                        onClick={() => handleTaskToggle(task)}
                        disabled={togglingTaskId === task.id}
                        aria-label={task.status === 'done' ? 'Reopen task' : 'Complete task'}
                        className="mt-0.5 rounded transition-colors hover:text-emerald-600 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                      >
                        {togglingTaskId === task.id ? (
                          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                        ) : task.status === 'done' ? (
                          <CheckCircle2
                            size={16}
                            className="text-emerald-500"
                            aria-hidden="true"
                          />
                        ) : (
                          <FileText size={16} aria-hidden="true" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-xs font-bold text-foreground ${
                            task.status === 'done' ? 'line-through opacity-60' : ''
                          }`}
                        >
                          {task.title}
                        </div>
                        {task.details && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {task.details}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[11px] ${
                            task.due_at
                              ? 'text-muted-foreground font-bold'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {task.due_at
                            ? new Date(`${task.due_at}T00:00:00`).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleStartEditTask(task)}
                            className="p-1 text-muted-foreground hover:text-primary dark:hover:text-primary-on-dark hover:bg-surface-muted rounded transition-colors"
                            title="Edit task"
                            aria-label={`Edit task: ${task.title}`}
                          >
                            <Edit2 size={13} />
                          </button>
                          <ConfirmAction
                            label="Delete Task"
                            message={`Delete follow-up "${task.title}"?`}
                            confirmLabel="Delete"
                            danger
                            idleClassName="p-1 text-muted-foreground hover:text-rose-600 hover:bg-surface-muted rounded transition-colors"
                            onConfirm={() => void handleDeleteTask(task.id)}
                          >
                            <Trash2 size={13} />
                          </ConfirmAction>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
  );
}
