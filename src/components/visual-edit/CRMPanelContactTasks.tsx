'use client';

import { AlertCircle, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { deleteCRMTask, setCRMTaskStatus } from '@/lib/actions/crm';
import type { CRMTask } from '@/types/unified';

interface CRMPanelContactTasksProps {
  contactId: string | null;
  tasks: CRMTask[];
  tasksLoading: boolean;
  taskFilter: 'all' | 'open' | 'done';
  setTaskFilter: (filter: 'all' | 'open' | 'done') => void;
  filteredTasks: CRMTask[];
  setIsTaskFormOpen: (open: boolean) => void;
  loadTasks: (contactId: string) => void;
}

export function CRMPanelContactTasks({
  contactId,
  tasks,
  tasksLoading,
  taskFilter,
  setTaskFilter,
  filteredTasks,
  setIsTaskFormOpen,
  loadTasks,
}: CRMPanelContactTasksProps) {
  return (
    <>
                    {/* Follow-ups */}
                    <div className="border-t border-border pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm">Follow-ups</h4>
                          {tasks.length > 0 && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setTaskFilter('all')}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                                  taskFilter === 'all'
                                    ? 'bg-primary text-white shadow-2xs'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                              >
                                All ({tasks.length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setTaskFilter('open')}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                                  taskFilter === 'open'
                                    ? 'bg-primary text-white shadow-2xs'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                              >
                                Open ({tasks.filter((t) => t.status !== 'done').length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setTaskFilter('done')}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                                  taskFilter === 'done'
                                    ? 'bg-primary text-white shadow-2xs'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                              >
                                Done ({tasks.filter((t) => t.status === 'done').length})
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsTaskFormOpen(true)}
                          className="px-2 py-1 text-xs font-bold rounded bg-primary text-white hover:bg-primary-light transition-colors"
                        >
                          <Plus size={12} className="mr-1" /> Add
                        </button>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto overscroll-contain">
                        {tasksLoading ? (
                          <div className="text-center py-4">
                            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : tasks.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            No follow-ups yet
                          </p>
                        ) : filteredTasks.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            No {taskFilter} follow-ups
                          </p>
                        ) : (
                          filteredTasks.map((task) => {
                            const isOverdue =
                              task.due_at &&
                              task.status !== 'done' &&
                              new Date(task.due_at).getTime() < Date.now();
                            return (
                              <div
                                key={task.id}
                                className="p-2.5 rounded-xl border border-border bg-background transition-colors hover:border-primary/30"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium truncate text-foreground">
                                    {task.title}
                                  </p>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {isOverdue && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-500">
                                        <AlertCircle size={10} />
                                        <span>Overdue</span>
                                      </span>
                                    )}
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                        task.status === 'done'
                                          ? 'bg-emerald-500/10 text-emerald-400'
                                          : task.status === 'in_progress'
                                            ? 'bg-amber-500/10 text-amber-400'
                                            : 'bg-slate-500/10 text-slate-400'
                                      }`}
                                    >
                                      {task.status.replace('_', ' ')}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mt-2 pt-1 border-t border-border/50 text-[10px]">
                                  {task.due_at ? (
                                    <span
                                      className={
                                        isOverdue
                                          ? 'font-bold text-rose-500'
                                          : 'text-muted-foreground'
                                      }
                                    >
                                      Due: {new Date(task.due_at).toLocaleDateString()}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">No due date</span>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (!contactId) return;
                                        const res = await setCRMTaskStatus({
                                          id: task.id,
                                          status: task.status === 'done' ? 'open' : 'done',
                                        });
                                        if (res.success) {
                                          if (res.warning) toast.warning(res.warning);
                                        } else {
                                          toast.error(res.error || 'Failed to update follow-up');
                                        }
                                        loadTasks(contactId);
                                      }}
                                      className="font-bold px-2 py-0.5 rounded bg-surface-muted hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                      aria-label={task.status === 'done' ? 'Reopen' : 'Complete'}
                                    >
                                      {task.status === 'done' ? 'Reopen' : 'Done'}
                                    </button>
                                    <ConfirmAction
                                      label="Delete task"
                                      message={`Delete "${task.title}"?`}
                                      confirmLabel="Delete"
                                      danger
                                      idleClassName="font-bold px-2 py-0.5 rounded hover:text-rose-600 text-muted-foreground hover:bg-rose-500/10 transition-colors"
                                      onConfirm={async () => {
                                        if (!contactId) return;
                                        const res = await deleteCRMTask(task.id);
                                        if (res.success) {
                                          if (res.warning) toast.warning(res.warning);
                                          toast.success('Task deleted');
                                        } else {
                                          toast.error(res.error || 'Failed to delete task');
                                        }
                                        loadTasks(contactId);
                                      }}
                                    >
                                      Del
                                    </ConfirmAction>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

    </>
  );
}
