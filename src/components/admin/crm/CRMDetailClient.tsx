'use client';

import {
  ArrowLeft,
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle2,
  DollarSign,
  Edit2,
  FileText,
  FolderOpen,
  GitMerge,
  Image as ImageIcon,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  Send,
  ShoppingBag,
  Trash2,
  UploadCloud,
  User,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { CRMContactEditorModal } from '@/components/admin/crm/CRMContactEditorModal';
import { CRMMergeModal } from '@/components/admin/crm/CRMMergeModal';
import { CRMMediaLibraryModal } from '@/components/admin/crm/composer/CRMMediaLibraryModal';
import {
  addCRMNote,
  addCRMTask,
  type ConsentDecision,
  type CRMActivity,
  type CRMContact,
  type CRMTask,
  deleteCRMContact,
  deleteCRMNote,
  deleteCRMTask,
  saveCRMContact,
  sendCRMDirectEmail,
  setCRMEmailConsent,
  setCRMTaskStatus,
  updateCRMNote,
  updateCRMTask,
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

type TabId = 'timeline' | 'tasks' | 'email' | 'note' | 'media';

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
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
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

  // Inline Contact Edit state
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState(contact.first_name || '');
  const [editLastName, setEditLastName] = useState(contact.last_name || '');
  const [editPhone, setEditPhone] = useState(contact.phone || '');
  const [editDistrict, setEditDistrict] = useState(contact.district || 'CA-06');
  const [editStatus, setEditStatus] = useState<
    'active_volunteer' | 'supporter' | 'donor' | 'choir' | 'organizer' | 'inactive'
  >(
    (contact.status as
      | 'active_volunteer'
      | 'supporter'
      | 'donor'
      | 'choir'
      | 'organizer'
      | 'inactive') || 'supporter'
  );
  const [editAddress, setEditAddress] = useState(contact.address || '');
  const [editCity, setEditCity] = useState(contact.city || '');
  const [editZipCode, setEditZipCode] = useState(contact.zip_code || '');
  const [editNotes, setEditNotes] = useState(contact.notes || '');
  const [savingContactInline, setSavingContactInline] = useState(false);

  // Inline Tag Add/Remove state
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [tagBusy, setTagBusy] = useState(false);

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

  const handleSaveContactInline = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingContactInline(true);
    try {
      const res = await saveCRMContact({
        id: contact.id,
        email: contact.email,
        first_name: editFirstName.trim() || null,
        last_name: editLastName.trim() || null,
        phone: editPhone.trim() || null,
        district: editDistrict,
        status: editStatus,
        address: editAddress.trim() || null,
        city: editCity.trim() || null,
        zip_code: editZipCode.trim() || null,
        notes: editNotes.trim() || null,
        tags: contact.tags,
      });
      if (res.success) {
        toast.success('Constituent updated');
        setIsInlineEditing(false);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update constituent');
      }
    } catch {
      toast.error('Update failed');
    } finally {
      setSavingContactInline(false);
    }
  };

  const handleAddTagInline = async () => {
    const raw = newTagInput.trim().toLowerCase();
    if (!raw) return;
    if (contact.tags.includes(raw)) {
      toast.info(`Tag #${raw} is already assigned`);
      setNewTagInput('');
      setIsAddingTag(false);
      return;
    }
    setTagBusy(true);
    try {
      const updatedTags = [...contact.tags, raw];
      const res = await saveCRMContact({
        id: contact.id,
        email: contact.email,
        tags: updatedTags,
      });
      if (res.success) {
        toast.success(`Tag #${raw} added`);
        setNewTagInput('');
        setIsAddingTag(false);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to add tag');
      }
    } catch {
      toast.error('Failed to add tag');
    } finally {
      setTagBusy(false);
    }
  };

  const handleRemoveTagInline = async (tagToRemove: string) => {
    setTagBusy(true);
    try {
      const updatedTags = contact.tags.filter((t) => t !== tagToRemove);
      const res = await saveCRMContact({
        id: contact.id,
        email: contact.email,
        tags: updatedTags,
      });
      if (res.success) {
        toast.success(`Tag #${tagToRemove} removed`);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to remove tag');
      }
    } catch {
      toast.error('Failed to remove tag');
    } finally {
      setTagBusy(false);
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
      {/* Back link */}
      <div>
        <Link
          href="/admin/crm"
          className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-muted-foreground hover:text-primary dark:hover:text-primary-on-dark dark:text-primary-on-dark transition-colors"
        >
          <ArrowLeft size={14} /> Back to Constituent Directory
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — 360 Profile Summary */}
        <div className="space-y-6">
          <div className="bg-surface-card rounded-2xl border border-border shadow-xs p-6 space-y-6">
            {isInlineEditing ? (
              <form onSubmit={handleSaveContactInline} className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary dark:text-primary-on-dark">
                    Edit Constituent In-Place
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsInlineEditing(false)}
                    className="p-1 rounded text-muted-foreground hover:text-muted-foreground"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-[10px] font-black uppercase text-muted-foreground">
                      <span className="block mb-1">First Name</span>
                      <input
                        type="text"
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                      />
                    </label>
                    <label className="block text-[10px] font-black uppercase text-muted-foreground">
                      <span className="block mb-1">Last Name</span>
                      <input
                        type="text"
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-[10px] font-black uppercase text-muted-foreground">
                      <span className="block mb-1">Phone</span>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="(916) 555-0199"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                      />
                    </label>
                    <label className="block text-[10px] font-black uppercase text-muted-foreground">
                      <span className="block mb-1">District</span>
                      <select
                        value={editDistrict}
                        onChange={(e) => setEditDistrict(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                      >
                        <option value="CA-06">CA-06</option>
                        <option value="CA-03">CA-03</option>
                        <option value="CA-07">CA-07</option>
                      </select>
                    </label>
                  </div>
                  <label className="block text-[10px] font-black uppercase text-muted-foreground">
                    <span className="block mb-1">Status</span>
                    <select
                      value={editStatus}
                      onChange={(e) =>
                        setEditStatus(
                          e.target.value as
                            | 'active_volunteer'
                            | 'supporter'
                            | 'donor'
                            | 'choir'
                            | 'organizer'
                            | 'inactive'
                        )
                      }
                      className="w-full px-2 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                    >
                      <option value="active_volunteer">Active Volunteer</option>
                      <option value="supporter">Supporter</option>
                      <option value="donor">Donor</option>
                      <option value="choir">Resistance Choir</option>
                      <option value="organizer">Organizer</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                  <label className="block text-[10px] font-black uppercase text-muted-foreground">
                    <span className="block mb-1">Address</span>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      placeholder="Street address"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-[10px] font-black uppercase text-muted-foreground">
                      <span className="block mb-1">City</span>
                      <input
                        type="text"
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                      />
                    </label>
                    <label className="block text-[10px] font-black uppercase text-muted-foreground">
                      <span className="block mb-1">Zip</span>
                      <input
                        type="text"
                        value={editZipCode}
                        onChange={(e) => setEditZipCode(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                      />
                    </label>
                  </div>
                  <label className="block text-[10px] font-black uppercase text-muted-foreground">
                    <span className="block mb-1">Organizer Notes</span>
                    <textarea
                      rows={3}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Background, skills, interests..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-border text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsInlineEditing(false)}
                    disabled={savingContactInline}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-muted-foreground hover:bg-surface-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingContactInline}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-dark transition-colors shadow-2xs disabled:opacity-50"
                  >
                    {savingContactInline ? <Loader2 size={12} className="animate-spin" /> : null}
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary dark:text-primary-on-dark block mb-1">
                      Constituent 360°
                    </span>
                    <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">
                      {fullName}
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">{contact.email}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
                    {contact.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Email consent state */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl border">
                  <label htmlFor="consent-state" className="min-w-0">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      Email consent
                    </span>
                    <select
                      id="consent-state"
                      value={
                        contact.do_not_email === null ? 'unasked' : String(contact.do_not_email)
                      }
                      disabled={consentBusy}
                      onChange={(e) => void handleConsentChange(e.target.value as ConsentDecision)}
                      className="mt-1 w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-50"
                    >
                      <option value="unasked">Never asked — not in the audience</option>
                      <option value="true">Opted out — not in the audience</option>
                      <option value="false">Agreed — receives broadcasts</option>
                    </select>
                  </label>
                  {contact.unsubscribed_at && (
                    <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
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
                <div className="space-y-3 pt-4 border-t border-border text-xs">
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <MapPin size={15} className="text-muted-foreground shrink-0" />
                    <span>
                      {contact.city || 'Fair Oaks'}, {contact.zip_code || 'CA'} &middot;{' '}
                      <strong className="text-foreground font-mono">{contact.district}</strong>
                    </span>
                  </div>

                  {contact.phone && (
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <Phone size={15} className="text-muted-foreground shrink-0" />
                      <span className="font-mono">{contact.phone}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Calendar size={15} className="text-muted-foreground shrink-0" />
                    <span>
                      Member since{' '}
                      {new Date(contact.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <DollarSign size={15} className="text-emerald-500 shrink-0" />
                    <span>
                      Total Contributions:{' '}
                      <strong className="text-emerald-600 font-mono">
                        ${(contact.total_donated_cents / 100).toFixed(2)}
                      </strong>
                    </span>
                  </div>

                  {(tasksTruncated ? openTaskCount : openTasks.length) > 0 && (
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <CalendarCheck size={15} className="text-amber-500 shrink-0" />
                      <span>
                        <strong className="text-foreground">
                          {tasksTruncated ? openTaskCount : openTasks.length}
                        </strong>{' '}
                        open follow-up
                        {(tasksTruncated ? openTaskCount : openTasks.length) === 1 ? '' : 's'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tags section with inline CRUD */}
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                      Interest & Action Tags
                    </div>
                    {!isAddingTag && (
                      <button
                        type="button"
                        onClick={() => setIsAddingTag(true)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-primary dark:text-primary-on-dark hover:underline"
                      >
                        <Plus size={11} /> Add Tag
                      </button>
                    )}
                  </div>

                  {isAddingTag && (
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <input
                        type="text"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleAddTagInline();
                          } else if (e.key === 'Escape') {
                            setIsAddingTag(false);
                          }
                        }}
                        placeholder="new-tag-name"
                        className="flex-1 px-2.5 py-1 rounded-lg border border-border text-xs font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddTagInline}
                        disabled={tagBusy || !newTagInput.trim()}
                        className="px-2.5 py-1 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-dark transition-colors disabled:opacity-50"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingTag(false)}
                        className="p-1 rounded text-muted-foreground hover:text-muted-foreground"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {contact.tags.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">No tags assigned</span>
                    ) : (
                      contact.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-muted text-slate-700 rounded-lg text-xs font-medium group/chip"
                        >
                          #{tag}
                          <button
                            type="button"
                            onClick={() => void handleRemoveTagInline(tag)}
                            disabled={tagBusy}
                            title={`Remove #${tag}`}
                            className="text-muted-foreground hover:text-red-600 ml-0.5 rounded-full p-0.5 transition-colors"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Internal Notes */}
                {contact.notes && (
                  <div className="pt-4 border-t border-border">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">
                      Organizer Notes
                    </div>
                    <p className="text-xs text-muted-foreground bg-surface-muted p-3 rounded-xl border border-border whitespace-pre-wrap leading-relaxed">
                      {contact.notes}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 pt-4 border-t border-border">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsInlineEditing(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary dark:text-primary-on-dark text-xs font-bold rounded-xl transition-colors"
                      title="Quick edit fields on this card"
                    >
                      <Edit2 size={13} /> Quick Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditorOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-muted hover:bg-surface-muted text-foreground text-xs font-bold rounded-xl transition-colors"
                    >
                      Modal
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMergeOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-muted hover:bg-surface-muted text-foreground text-xs font-bold rounded-xl transition-colors"
                      title="Merge a duplicate contact into this profile"
                    >
                      <GitMerge size={13} /> Merge
                    </button>
                  </div>

                  <ConfirmAction
                    label={`Delete ${fullName}`}
                    message={`Are you sure you want to delete ${fullName} (${contact.email})? This action cannot be undone.`}
                    confirmLabel="Delete Constituent"
                    danger
                    busy={deleting}
                    idleClassName="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                    onConfirm={() => void handleDelete()}
                  >
                    <Trash2 size={13} /> Delete
                  </ConfirmAction>
                </div>
              </>
            )}
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
            <button
              type="button"
              onClick={() => setActiveTab('media')}
              className={tabClass('media')}
            >
              <ImageIcon size={14} aria-hidden="true" /> Storage Media
            </button>
          </fieldset>

          {/* Tab: Timeline */}
          {activeTab === 'timeline' && (
            <div className="bg-surface-card rounded-2xl border border-border shadow-xs p-6">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-6">
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
                <div className="text-center py-12 text-muted-foreground text-xs">
                  No recorded activities yet for this constituent.
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-muted">
                  {activities.map((act) => {
                    let icon = <FileText size={12} />;
                    let badgeClass = 'bg-surface-muted text-slate-700';

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
                                        className="p-1 text-muted-foreground hover:text-primary dark:hover:text-primary-on-dark dark:text-primary-on-dark hover:bg-surface-card rounded transition-colors"
                                        title="Edit note"
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
                  Showing the {activities.length} most recent of {activityCount} recorded
                  activities. Older entries are still stored — a campaign blast to this constituent
                  accounts for most of them.
                </p>
              )}
            </div>
          )}

          {/* Tab: Follow-ups */}
          {activeTab === 'tasks' && (
            <div className="bg-surface-card rounded-2xl border border-border shadow-xs p-6 space-y-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary dark:text-primary-on-dark">
                  Organizer Follow-ups
                </span>
                <h2 className="text-lg font-black uppercase tracking-tight text-foreground">
                  Schedule & Track Tasks
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
                      Showing {tasks.length} of {taskCount} recorded follow-ups. Older entries are
                      still stored — manage the full list on the tasks board.
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
                                  ? new Date(`${task.due_at}T00:00:00`).toLocaleDateString(
                                      'en-US',
                                      {
                                        month: 'short',
                                        day: 'numeric',
                                      }
                                    )
                                  : '—'}
                              </span>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditTask(task)}
                                  className="p-1 text-muted-foreground hover:text-primary dark:hover:text-primary-on-dark dark:text-primary-on-dark hover:bg-surface-muted rounded transition-colors"
                                  title="Edit task"
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
          )}

          {/* Tab: Send Direct Email */}
          {activeTab === 'email' && (
            <div className="bg-surface-card rounded-2xl border border-border shadow-xs p-6 space-y-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary dark:text-primary-on-dark">
                  Resend Email Engine
                </span>
                <h2 className="text-lg font-black uppercase tracking-tight text-foreground">
                  Direct Outreach to {fullName}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sends directly to <strong className="text-foreground">{contact.email}</strong>{' '}
                  using the Sensory Luxury email template from{' '}
                  <code className="text-primary dark:text-primary-on-dark font-bold">
                    contact@indivisiblefairoaks.org
                  </code>
                  .
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
                    className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1"
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
                    className="w-full px-4 py-2.5 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm disabled:bg-surface-muted disabled:text-muted-foreground"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email-message"
                    className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1"
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
                    className="w-full px-4 py-2.5 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm leading-relaxed disabled:bg-surface-muted disabled:text-muted-foreground"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-muted-foreground">
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
            <div className="bg-surface-card rounded-2xl border border-border shadow-xs p-6 space-y-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary dark:text-primary-on-dark">
                  Organizer Observations
                </span>
                <h2 className="text-lg font-black uppercase tracking-tight text-foreground">
                  Log Meeting Note or Engagement Activity
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
          )}

          {/* Tab: Storage Media Assets */}
          {activeTab === 'media' && (
            <div className="bg-surface-card rounded-2xl border border-border shadow-xs p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary dark:text-primary-on-dark">
                    Supabase S3 Assets
                  </span>
                  <h2 className="text-lg font-black uppercase tracking-tight text-foreground">
                    Constituent Media & Documents
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Browse and attach assets hosted in your Supabase S3 bucket for this profile.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMediaModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white hover:bg-primary-light text-xs font-black uppercase tracking-widest rounded-xl transition-colors shadow-xs"
                >
                  <FolderOpen size={14} /> Open Storage Library
                </button>
              </div>

              <div className="p-8 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
                <div className="p-3 rounded-full bg-blue-50 text-primary dark:text-primary-on-dark">
                  <ImageIcon className="h-8 w-8" />
                </div>
                <div className="max-w-md">
                  <h3 className="text-sm font-bold text-foreground">
                    Manage Supabase Media Assets
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload photos from rallies, volunteer sign-up sheets, or documents directly to
                    your Supabase S3 storage bucket.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMediaModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-secondary text-white hover:bg-secondary/90 text-xs font-bold rounded-xl transition-colors shadow-sm"
                >
                  <UploadCloud size={14} /> Browse & Upload Files
                </button>
              </div>
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
