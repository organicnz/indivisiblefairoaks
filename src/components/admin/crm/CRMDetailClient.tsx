'use client';

import {
  ArrowLeft,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  DollarSign,
  Edit2,
  FileText,
  GitMerge,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  Send,
  ShoppingBag,
  Trash2,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { CRMContactEditorModal } from '@/components/admin/crm/CRMContactEditorModal';
import { CRMMergeModal } from '@/components/admin/crm/CRMMergeModal';
import {
  addCRMNote,
  addCRMTask,
  type ConsentDecision,
  type CRMActivity,
  type CRMContact,
  type CRMTask,
  deleteCRMContact,
  sendCRMDirectEmail,
  setCRMEmailConsent,
  setCRMTaskStatus,
} from '@/lib/actions/crm';

interface Props {
  contact: CRMContact;
  activities: CRMActivity[];
  tasks: CRMTask[];
  /** True when the server cut `activities` short of the full history. */
  activitiesTruncated: boolean;
  /** Every activity on record, which is more than `activities.length`. */
  activityCount: number;
  /** True when the server cut `tasks` at its cap. */
  tasksTruncated: boolean;
  /** Every task on record, which is more than `tasks.length` when truncated. */
  taskCount: number;
  /** Open tasks on record — the tab label counts open, not total. */
  openTaskCount: number;
}

type TabId = 'timeline' | 'tasks' | 'email' | 'note';

export function CRMDetailClient({
  contact,
  activities,
  tasks,
  activitiesTruncated,
  activityCount,
  tasksTruncated,
  taskCount,
  openTaskCount,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('timeline');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);

  // Email form state
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Note form state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteDesc, setNoteDesc] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDetails, setTaskDetails] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [savingTask, setSavingTask] = useState(false);

  const openTasks = tasks.filter((t) => t.status === 'open');

  const fullName =
    [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
    contact.email.split('@')[0];

  const handleDelete = async () => {
    // No confirm() here: the ConfirmAction below only calls this from its
    // inline confirm step, which already named the constituent and the
    // consequence.
    setDeleting(true);
    try {
      const res = await deleteCRMContact(contact.id);
      if (res.success) {
        toast.success('Constituent deleted');
        // `refresh()` first, so the redirect cannot resolve before this row is
        // gone. The two race otherwise, and the redirect lands on a directory
        // that still lists the row just deleted — which reads as a failed delete.
        router.refresh();
        router.push('/admin/crm');
      } else {
        toast.error(res.error || 'Failed to delete');
      }
    } catch {
      toast.error('Deletion failed');
    } finally {
      setDeleting(false);
    }
  };

  /**
   * Set one of the three consent states.
   *
   * Not a toggle. A toggle can only move between two values, and the third one —
   * "we have never asked this person" — is exactly the state an organiser needs
   * to be able to record and a toggle cannot reach. Its nearest equivalent, clearing
   * the opt-out flag, wrote a *yes* nobody had given and put the person in the
   * next broadcast.
   *
   * The switch replaces a `ConfirmAction`, deliberately: choosing a state here is
   * a deliberate three-way decision, not a two-step destructive confirmation, and
   * the select's own options each name their consequence. Opting *out* is the one
   * direction that reduces someone's rights, and it is still one click — which is
   * correct, because an opt-out is not destructive to the person and is
   * reversible from the same control.
   */
  const handleConsentChange = async (next: ConsentDecision) => {
    setConsentBusy(true);
    try {
      const res = await setCRMEmailConsent({ contactId: contact.id, doNotEmail: next });
      if (res.success) {
        toast.success(
          next === 'opted_out'
            ? 'Marked do-not-email'
            : next === 'opted_in'
              ? 'Email consent restored'
              : 'Consent reset to "never asked"'
        );
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update consent');
      }
    } catch {
      toast.error('Failed to update consent');
    } finally {
      setConsentBusy(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailSubject.trim() || !emailMessage.trim()) {
      toast.error('Subject and message are required');
      return;
    }

    setSendingEmail(true);
    try {
      const res = await sendCRMDirectEmail({
        contactId: contact.id,
        subject: emailSubject,
        message: emailMessage,
      });

      if (res.success) {
        toast.success(`Email dispatched to ${contact.email} via Resend`);
        setEmailSubject('');
        setEmailMessage('');
        setActiveTab('timeline');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to dispatch email');
      }
    } catch {
      toast.error('Email dispatch failed');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) {
      toast.error('Note title is required');
      return;
    }

    setSavingNote(true);
    try {
      const res = await addCRMNote({
        contactId: contact.id,
        title: noteTitle,
        description: noteDesc,
      });

      if (res.success) {
        toast.success('Organizer note recorded');
        setNoteTitle('');
        setNoteDesc('');
        setActiveTab('timeline');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to record note');
      }
    } catch {
      toast.error('Failed to record note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      toast.error('Task title is required');
      return;
    }
    setSavingTask(true);
    try {
      const res = await addCRMTask({
        contactId: contact.id,
        title: taskTitle,
        details: taskDetails || null,
        dueAt: taskDue || null,
      });
      if (res.success) {
        toast.success('Follow-up scheduled');
        setTaskTitle('');
        setTaskDetails('');
        setTaskDue('');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to add follow-up');
      }
    } catch {
      toast.error('Failed to add follow-up');
    } finally {
      setSavingTask(false);
    }
  };

  const handleTaskToggle = async (task: CRMTask) => {
    // Guarded like every other handler in this file. Without the try/catch and
    // the in-flight lock, a double-click fired two mutations and a rejection
    // surfaced as an unhandled promise with no feedback at all.
    if (togglingTaskId === task.id) return;
    setTogglingTaskId(task.id);
    const next = task.status === 'done' ? 'open' : 'done';
    try {
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
      setTogglingTaskId(null);
    }
  };

  const tabClass = (id: TabId) =>
    `inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${
      activeTab === id
        ? 'bg-primary text-white shadow-xs'
        : 'bg-white text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/admin/crm"
          className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft size={14} /> Back to Constituent Directory
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — 360 Profile Summary */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary block mb-1">
                  Constituent 360°
                </span>
                <h1 className="text-2xl font-black uppercase tracking-tight text-secondary">
                  {fullName}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">{contact.email}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
                {contact.status.replace('_', ' ')}
              </span>
            </div>

            {/*
              Three states, not two, and the control is a select rather than a
              toggle because a two-state toggle cannot express the middle one.

              The old toggle's only options were "opted out" and "opted in", so
              the nearest an organiser could get to "we have never asked this
              person" was to clear the flag — which recorded a **yes** nobody had
              given, and put them in the next broadcast. That is the one state an
              admin action must never invent.

              Each of the three is reachable, and each names its consequence: two
              of the three mean this person is in no broadcast audience, and the
              copy says so rather than leaving it to be worked out.
            */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl border">
              <label htmlFor="consent-state" className="min-w-0">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Email consent
                </span>
                <select
                  id="consent-state"
                  value={contact.do_not_email === null ? 'unasked' : String(contact.do_not_email)}
                  disabled={consentBusy}
                  onChange={(e) => void handleConsentChange(e.target.value as ConsentDecision)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-50"
                >
                  <option value="unasked">Never asked — not in the audience</option>
                  <option value="true">Opted out — not in the audience</option>
                  <option value="false">Agreed — receives broadcasts</option>
                </select>
              </label>
              {contact.unsubscribed_at && (
                <span className="shrink-0 text-[10px] font-medium text-slate-400">
                  Unsubscribed{' '}
                  {new Date(contact.unsubscribed_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              )}
            </div>

            {/* Quick Metadata */}
            <div className="space-y-3 pt-4 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2.5 text-slate-600">
                <MapPin size={15} className="text-slate-400 shrink-0" />
                <span>
                  {contact.city || 'Fair Oaks'}, {contact.zip_code || 'CA'} &middot;{' '}
                  <strong className="text-secondary font-mono">{contact.district}</strong>
                </span>
              </div>

              {contact.phone && (
                <div className="flex items-center gap-2.5 text-slate-600">
                  <Phone size={15} className="text-slate-400 shrink-0" />
                  <span className="font-mono">{contact.phone}</span>
                </div>
              )}

              <div className="flex items-center gap-2.5 text-slate-600">
                <Calendar size={15} className="text-slate-400 shrink-0" />
                <span>
                  Member since{' '}
                  {new Date(contact.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>

              <div className="flex items-center gap-2.5 text-slate-600">
                <DollarSign size={15} className="text-emerald-500 shrink-0" />
                <span>
                  Total Contributions:{' '}
                  <strong className="text-emerald-600 font-mono">
                    ${(contact.total_donated_cents / 100).toFixed(2)}
                  </strong>
                </span>
              </div>

              {(tasksTruncated ? openTaskCount : openTasks.length) > 0 && (
                <div className="flex items-center gap-2.5 text-slate-600">
                  <CalendarCheck size={15} className="text-amber-500 shrink-0" />
                  <span>
                    <strong className="text-secondary">
                      {tasksTruncated ? openTaskCount : openTasks.length}
                    </strong>{' '}
                    open follow-up
                    {(tasksTruncated ? openTaskCount : openTasks.length) === 1 ? '' : 's'}
                  </span>
                </div>
              )}
            </div>

            {/* Tags section */}
            <div className="pt-4 border-t border-slate-100">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                Interest & Action Tags
              </div>
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">No tags assigned</span>
                ) : (
                  contact.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium"
                    >
                      #{tag}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Internal Notes */}
            {contact.notes && (
              <div className="pt-4 border-t border-slate-100">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
                  Organizer Notes
                </div>
                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap leading-relaxed">
                  {contact.notes}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-secondary text-xs font-bold rounded-xl transition-colors"
                >
                  <Edit2 size={13} /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => setIsMergeOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-secondary text-xs font-bold rounded-xl transition-colors"
                  title="Merge a duplicate contact into this profile"
                >
                  <GitMerge size={13} /> Merge
                </button>
              </div>

              <ConfirmAction
                label={`Delete ${fullName}`}
                message={`Delete ${fullName}? This cannot be undone. Everything this profile holds goes with it — the timeline, every note, every follow-up task, and the giving history. The list cannot be recovered from anywhere.`}
                danger
                busy={deleting}
                idleClassName="inline-flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                onConfirm={() => void handleDelete()}
              >
                <Trash2 size={13} aria-hidden="true" /> Delete
              </ConfirmAction>
            </div>
          </div>
        </div>

        {/* Right Column — Tabbed Activities, Tasks, Email Sender, and Note Composer */}
        <div className="lg:col-span-2 space-y-6">
          {/*
            Navigation tabs.

            A `<fieldset>`/`<legend>` pair, `tabIndex={0}`, on the scroll
            container: an `overflow-x-auto` element is no longer focusable by
            default in Chrome or Firefox, so without it a keyboard user cannot
            scroll four tabs sideways on a narrow viewport. The `<legend>` is what
            gives that focus a purpose — see `ContentList.tsx` for the same
            pattern, and AGENTS.md for why it exists.
          */}
          <fieldset
            className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: WAI-ARIA scrollable region, see AGENTS.md "Scrollable regions must be focusable"
            tabIndex={0}
          >
            {/*
              Deliberately *not* `role="tablist"`. That pattern requires
              `aria-selected`, `aria-controls` and arrow-key handling to behave
              correctly, and claiming it without those announces tabs that do not
              behave like tabs. A fieldset says "these four buttons are one group"
              and is honest about what this is.
            */}
            <legend className="sr-only">Constituent profile sections</legend>
            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={tabClass('timeline')}
            >
              <FileText size={14} aria-hidden="true" /> Timeline ({activityCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className={tabClass('tasks')}
            >
              <CalendarCheck size={14} aria-hidden="true" /> Follow-ups (
              {tasksTruncated ? openTaskCount : openTasks.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('email')}
              className={tabClass('email')}
            >
              <Mail size={14} aria-hidden="true" /> Email
            </button>
            <button type="button" onClick={() => setActiveTab('note')} className={tabClass('note')}>
              <MessageSquare size={14} aria-hidden="true" /> Note
            </button>
          </fieldset>

          {/* Tab: Timeline */}
          {activeTab === 'timeline' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-6">
                Interaction History & Civic Record
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
                <div className="text-center py-12 text-slate-400 text-xs">
                  No recorded activities yet for this constituent.
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {activities.map((act) => {
                    let icon = <FileText size={12} />;
                    let badgeClass = 'bg-slate-100 text-slate-700';

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
                        <span className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-white border-2 border-primary flex items-center justify-center text-[8px]" />
                        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors space-y-1">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-bold text-secondary flex items-center gap-1.5">
                              <span className={`p-1 rounded-md ${badgeClass}`}>{icon}</span>
                              {act.title}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {new Date(act.created_at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                              })}
                            </span>
                          </div>
                          {act.description && (
                            <p className="text-xs text-slate-600 whitespace-pre-wrap pl-6 pt-1 leading-relaxed">
                              {act.description}
                            </p>
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
                  Showing the {activities.length} most recent of {activityCount} recorded
                  activities. Older entries are still stored — a campaign blast to this constituent
                  accounts for most of them.
                </p>
              )}
            </div>
          )}

          {/* Tab: Follow-ups */}
          {activeTab === 'tasks' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  Organizer Follow-ups
                </span>
                <h2 className="text-lg font-black uppercase tracking-tight text-secondary">
                  Schedule & Track Tasks
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Due-dated commitments for this constituent.{' '}
                  <Link href="/admin/crm/tasks" className="text-primary font-bold hover:underline">
                    Open the full board →
                  </Link>
                </p>
              </div>

              <form onSubmit={handleAddTask} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="task-title"
                      className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
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
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="task-due"
                      className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
                    >
                      Due date
                    </label>
                    <input
                      id="task-due"
                      type="date"
                      value={taskDue}
                      onChange={(e) => setTaskDue(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="task-details"
                    className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
                  >
                    Details
                  </label>
                  <textarea
                    id="task-details"
                    rows={2}
                    value={taskDetails}
                    onChange={(e) => setTaskDetails(e.target.value)}
                    placeholder="Context, phone number, promised deliverable…"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm"
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
                <div className="text-center py-8 text-slate-400 text-xs border-t border-slate-100">
                  No follow-ups yet.
                </div>
              ) : (
                <>
                  {tasksTruncated && (
                    <p
                      role="status"
                      className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-900"
                    >
                      Showing {tasks.length} of {taskCount} recorded follow-ups. Older entries are
                      still stored — manage the full list on the tasks board.
                    </p>
                  )}
                  <ul className="divide-y divide-slate-100 border-t border-slate-100">
                    {tasks.map((task) => (
                      <li key={task.id} className="flex items-start gap-3 py-3">
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
                            className={`text-xs font-bold text-secondary ${
                              task.status === 'done' ? 'line-through opacity-60' : ''
                            }`}
                          >
                            {task.title}
                          </div>
                          {task.details && (
                            <p className="text-[11px] text-slate-500 mt-0.5">{task.details}</p>
                          )}
                        </div>
                        <span
                          className={`text-[11px] shrink-0 ${
                            task.due_at ? 'text-slate-500 font-bold' : 'text-slate-300'
                          }`}
                        >
                          {task.due_at
                            ? new Date(`${task.due_at}T00:00:00`).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {/* Tab: Send Direct Email */}
          {activeTab === 'email' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  Resend Email Engine
                </span>
                <h2 className="text-lg font-black uppercase tracking-tight text-secondary">
                  Direct Outreach to {fullName}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sends directly to <strong className="text-secondary">{contact.email}</strong>{' '}
                  using the Sensory Luxury email template from{' '}
                  <code className="text-primary font-bold">contact@indivisiblefairoaks.org</code>.
                </p>
                {contact.do_not_email === true && (
                  <p className="mt-2 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    This contact is marked do-not-email — sending is blocked until consent is
                    restored.
                  </p>
                )}
                {/*
                  `!== false`, not truthiness, in all three places below — and a
                  banner here for the state the old code rendered as an enabled
                  form. `NULL` means "never asked", and the consent select two
                  panels up already says so ("Never asked — not in the
                  audience"); a send form with no warning under it contradicted
                  the panel on the same screen.
                */}
                {contact.do_not_email === null && (
                  <p className="mt-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    No consent on file — this contact was never asked. Sending is blocked until they
                    opt in.
                  </p>
                )}
              </div>

              <form onSubmit={handleSendEmail} className="space-y-4">
                <div>
                  <label
                    htmlFor="email-subject"
                    className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
                  >
                    Subject Line *
                  </label>
                  <input
                    id="email-subject"
                    type="text"
                    required
                    disabled={contact.do_not_email !== false}
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="e.g. Next steps for our Postcard Blitz campaign"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email-message"
                    className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
                  >
                    Message Body *
                  </label>
                  <textarea
                    id="email-message"
                    required
                    rows={8}
                    disabled={contact.do_not_email !== false}
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    placeholder="Type your message to this constituent..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm leading-relaxed disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-400">
                    Replies will route to chapter inbox:{' '}
                    <strong>contact@indivisiblefairoaks.org</strong>
                  </span>
                  <button
                    type="submit"
                    disabled={sendingEmail || contact.do_not_email !== false}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white hover:bg-primary-light text-xs font-black uppercase tracking-widest rounded-xl transition-colors shadow-md disabled:opacity-50"
                  >
                    <Send size={14} />
                    {sendingEmail ? 'Dispatching...' : 'Send Message'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tab: Log Organizer Note */}
          {activeTab === 'note' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  Organizer Observations
                </span>
                <h2 className="text-lg font-black uppercase tracking-tight text-secondary">
                  Log Meeting Note or Engagement Activity
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Record organizing interactions, volunteer commitments, or conversations.
                </p>
              </div>

              <form onSubmit={handleAddNote} className="space-y-4">
                <div>
                  <label
                    htmlFor="note-title"
                    className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
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
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="note-desc"
                    className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
                  >
                    Detailed Notes & Action Items
                  </label>
                  <textarea
                    id="note-desc"
                    rows={5}
                    value={noteDesc}
                    onChange={(e) => setNoteDesc(e.target.value)}
                    placeholder="Details of the conversation, follow-up dates, volunteer availability..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm leading-relaxed"
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
          )}
        </div>
      </div>

      {/* Profile Edit Modal */}
      {isEditorOpen && (
        <CRMContactEditorModal
          contact={contact}
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
        />
      )}

      {/* Merge Modal */}
      {isMergeOpen && (
        <CRMMergeModal keep={contact} isOpen={isMergeOpen} onClose={() => setIsMergeOpen(false)} />
      )}
    </div>
  );
}
