'use client';

import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Edit2,
  FileText,
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
import { CRMContactEditorModal } from '@/components/admin/crm/CRMContactEditorModal';
import {
  addCRMNote,
  type CRMActivity,
  type CRMContact,
  deleteCRMContact,
  sendCRMDirectEmail,
} from '@/lib/actions/crm';

interface Props {
  contact: CRMContact;
  activities: CRMActivity[];
}

export function CRMDetailClient({ contact, activities }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'timeline' | 'email' | 'note'>('timeline');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Email form state
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Note form state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteDesc, setNoteDesc] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const fullName =
    [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
    contact.email.split('@')[0];

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${fullName}? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await deleteCRMContact(contact.id);
      if (res.success) {
        toast.success('Constituent deleted');
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
              <button
                type="button"
                onClick={() => setIsEditorOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-secondary text-xs font-bold rounded-xl transition-colors"
              >
                <Edit2 size={13} /> Edit Profile
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>
        </div>

        {/* Right Column — Tabbed Activities, Email Sender, and Note Composer */}
        <div className="lg:col-span-2 space-y-6">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${
                activeTab === 'timeline'
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText size={14} /> Activity Timeline ({activities.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('email')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${
                activeTab === 'email'
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Mail size={14} /> Send Direct Email
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('note')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${
                activeTab === 'note'
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              <MessageSquare size={14} /> Log Organizer Note
            </button>
          </div>

          {/* Tab 1: Timeline */}
          {activeTab === 'timeline' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-6">
                Interaction History & Civic Record
              </h2>

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
            </div>
          )}

          {/* Tab 2: Send Direct Email */}
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
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="e.g. Next steps for our Postcard Blitz campaign"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-sm"
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
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    placeholder="Type your message to this constituent..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-sm leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-400">
                    Replies will route to chapter inbox:{' '}
                    <strong>contact@indivisiblefairoaks.org</strong>
                  </span>
                  <button
                    type="submit"
                    disabled={sendingEmail}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white hover:bg-primary-light text-xs font-black uppercase tracking-widest rounded-xl transition-colors shadow-md disabled:opacity-50"
                  >
                    <Send size={14} />
                    {sendingEmail ? 'Dispatching...' : 'Send Message'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tab 3: Log Organizer Note */}
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
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-sm"
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
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-sm leading-relaxed"
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
    </div>
  );
}
