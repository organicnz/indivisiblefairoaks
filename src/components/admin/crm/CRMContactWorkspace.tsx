'use client';

import {
  CalendarCheck,
  Check,
  CheckCircle2,
  Edit2,
  FileText,
  FolderOpen,
  GitMerge,
  Image as ImageIcon,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  Send,
  ShoppingBag,
  Trash2,
  UploadCloud,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { CRMMediaLibraryModal } from '@/components/admin/crm/composer/CRMMediaLibraryModal';
import { CRMContactEmailTab } from '@/components/admin/crm/CRMContactEmailTab';
import { CRMContactMediaTab } from '@/components/admin/crm/CRMContactMediaTab';
import { CRMContactNoteTab } from '@/components/admin/crm/CRMContactNoteTab';
import { CRMContactTasksTab } from '@/components/admin/crm/CRMContactTasksTab';
import { CRMContactTimelineTab } from '@/components/admin/crm/CRMContactTimelineTab';
import {
  addCRMNote,
  addCRMTask,
  deleteCRMNote,
  deleteCRMTask,
  sendCRMDirectEmail,
  setCRMTaskStatus,
  updateCRMNote,
  updateCRMTask,
} from '@/lib/actions/crm';
import type { CRMActivity, CRMContact, CRMTask } from '@/types/crm';

type TabId = 'timeline' | 'tasks' | 'email' | 'note' | 'media';

interface CRMContactWorkspaceProps {
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

export function CRMContactWorkspace({
  contact,
  activities,
  tasks,
  activitiesTruncated,
  activityCount,
  tasksTruncated,
  taskCount,
  openTaskCount,
}: CRMContactWorkspaceProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('timeline');

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

  // Note Edit state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteTitle, setEditingNoteTitle] = useState('');
  const [editingNoteDesc, setEditingNoteDesc] = useState('');
  const [updatingNote, setUpdatingNote] = useState(false);

  // Task Edit state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');
  const [editingTaskDetails, setEditingTaskDetails] = useState('');
  const [editingTaskDue, setEditingTaskDue] = useState('');
  const [updatingTask, setUpdatingTask] = useState(false);

  // Supabase media library state
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);

  const fullName =
    [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
    contact.email.split('@')[0];

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
        if (res.warning) toast.warning(res.warning);
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

  const handleStartEditNote = (act: CRMActivity) => {
    setEditingNoteId(act.id);
    setEditingNoteTitle(act.title);
    setEditingNoteDesc(act.description || '');
  };

  const handleUpdateNote = async (activityId: string) => {
    if (!editingNoteTitle.trim()) {
      toast.error('Note title is required');
      return;
    }
    setUpdatingNote(true);
    try {
      const res = await updateCRMNote({
        activityId,
        title: editingNoteTitle,
        description: editingNoteDesc,
      });
      if (res.success) {
        toast.success('Note updated');
        setEditingNoteId(null);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update note');
      }
    } catch {
      toast.error('Failed to update note');
    } finally {
      setUpdatingNote(false);
    }
  };

  const handleDeleteNote = async (activityId: string) => {
    try {
      const res = await deleteCRMNote(activityId);
      if (res.success) {
        toast.success('Note deleted');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to delete note');
      }
    } catch {
      toast.error('Failed to delete note');
    }
  };

  const handleStartEditTask = (task: CRMTask) => {
    setEditingTaskId(task.id);
    setEditingTaskTitle(task.title);
    setEditingTaskDetails(task.details || '');
    setEditingTaskDue(task.due_at || '');
  };

  const handleUpdateTask = async (taskId: string) => {
    if (!editingTaskTitle.trim()) {
      toast.error('Task title is required');
      return;
    }
    setUpdatingTask(true);
    try {
      const res = await updateCRMTask({
        id: taskId,
        title: editingTaskTitle,
        details: editingTaskDetails || null,
        dueAt: editingTaskDue || null,
      });
      if (res.success) {
        toast.success('Follow-up updated');
        setEditingTaskId(null);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update task');
      }
    } catch {
      toast.error('Failed to update task');
    } finally {
      setUpdatingTask(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await deleteCRMTask(taskId);
      if (res.success) {
        toast.success('Follow-up deleted');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to delete follow-up');
      }
    } catch {
      toast.error('Failed to delete follow-up');
    }
  };

  const tabClass = (id: TabId) =>
    `inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${
      activeTab === id
        ? 'bg-primary text-white shadow-xs'
        : 'bg-surface-card text-muted-foreground hover:bg-surface-muted'
    }`;

  return (
    <div className="space-y-6">
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
        className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto"
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
        <button type="button" onClick={() => setActiveTab('tasks')} className={tabClass('tasks')}>
          <CalendarCheck size={14} aria-hidden="true" /> Follow-ups (
          {tasksTruncated ? openTaskCount : tasks.filter((t) => t.status === 'open').length})
        </button>
        <button type="button" onClick={() => setActiveTab('email')} className={tabClass('email')}>
          <Mail size={14} aria-hidden="true" /> Email
        </button>
        <button type="button" onClick={() => setActiveTab('note')} className={tabClass('note')}>
          <MessageSquare size={14} aria-hidden="true" /> Note
        </button>
        <button type="button" onClick={() => setActiveTab('media')} className={tabClass('media')}>
          <ImageIcon size={14} aria-hidden="true" /> Storage Media
        </button>
      </fieldset>

      {/* Tab: Timeline */}
      {activeTab === 'timeline' && (
        <CRMContactTimelineTab
          activities={activities}
          activitiesTruncated={activitiesTruncated}
          activityCount={activityCount}
          editingNoteId={editingNoteId}
          setEditingNoteId={setEditingNoteId}
          editingNoteTitle={editingNoteTitle}
          setEditingNoteTitle={setEditingNoteTitle}
          editingNoteDesc={editingNoteDesc}
          setEditingNoteDesc={setEditingNoteDesc}
          updatingNote={updatingNote}
          handleUpdateNote={(id) => void handleUpdateNote(id)}
          handleStartEditNote={handleStartEditNote}
          handleDeleteNote={(id) => void handleDeleteNote(id)}
        />
      )}

      {/* Tab: Follow-ups */}
      {activeTab === 'tasks' && (
        <CRMContactTasksTab
          tasks={tasks}
          tasksTruncated={tasksTruncated}
          taskCount={taskCount}
          taskTitle={taskTitle}
          setTaskTitle={setTaskTitle}
          taskDetails={taskDetails}
          setTaskDetails={setTaskDetails}
          taskDue={taskDue}
          setTaskDue={setTaskDue}
          savingTask={savingTask}
          handleAddTask={(e) => void handleAddTask(e)}
          editingTaskId={editingTaskId}
          setEditingTaskId={setEditingTaskId}
          editingTaskTitle={editingTaskTitle}
          setEditingTaskTitle={setEditingTaskTitle}
          editingTaskDetails={editingTaskDetails}
          setEditingTaskDetails={setEditingTaskDetails}
          editingTaskDue={editingTaskDue}
          setEditingTaskDue={setEditingTaskDue}
          updatingTask={updatingTask}
          handleUpdateTask={(id) => void handleUpdateTask(id)}
          handleStartEditTask={handleStartEditTask}
          togglingTaskId={togglingTaskId}
          handleTaskToggle={(task) => void handleTaskToggle(task)}
          handleDeleteTask={(id) => void handleDeleteTask(id)}
        />
      )}

      {/* Tab: Send Direct Email */}
      {activeTab === 'email' && (
        <CRMContactEmailTab
          contact={contact}
          fullName={fullName}
          emailSubject={emailSubject}
          setEmailSubject={setEmailSubject}
          emailMessage={emailMessage}
          setEmailMessage={setEmailMessage}
          sendingEmail={sendingEmail}
          handleSendEmail={(e) => void handleSendEmail(e)}
        />
      )}

      {/* Tab: Log Organizer Note */}
      {activeTab === 'note' && (
        <CRMContactNoteTab
          noteTitle={noteTitle}
          setNoteTitle={setNoteTitle}
          noteDesc={noteDesc}
          setNoteDesc={setNoteDesc}
          savingNote={savingNote}
          handleAddNote={(e) => void handleAddNote(e)}
          setIsMediaModalOpen={setIsMediaModalOpen}
        />
      )}

      {/* Tab: Storage Media Assets */}
      {activeTab === 'media' && (
        <CRMContactMediaTab setIsMediaModalOpen={setIsMediaModalOpen} />
      )}

      {/* Supabase Media Library Modal */}
      <CRMMediaLibraryModal
        isOpen={isMediaModalOpen}
        onClose={() => setIsMediaModalOpen(false)}
        onSelectMedia={(media) => {
          const alt = media.alt || media.name;
          setNoteDesc((prev) => `${prev ? `${prev}\n\n` : ''}![${alt}](${media.url})`);
          toast.success('Media reference inserted into note');
          setIsMediaModalOpen(false);
          setActiveTab('note');
        }}
        initialFolder="crm"
      />
    </div>
  );
}
