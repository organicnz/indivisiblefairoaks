'use client';

import {
  Activity,
  Calendar,
  CalendarCheck,
  DollarSign,
  Edit2,
  GitMerge,
  Inbox,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { CRMContactEditorModal } from '@/components/admin/crm/CRMContactEditorModal';
import { CRMMergeModal } from '@/components/admin/crm/CRMMergeModal';
import { deleteCRMContact, saveCRMContact, setCRMEmailConsent } from '@/lib/actions/crm';
import {
  CRM_CONTACT_CONSENT_OPTIONS,
  CRM_CONTACT_DEFAULTS,
  CRM_CONTACT_DISTRICT_OPTIONS,
  CRM_CONTACT_STATUS_OPTIONS,
  crmContactConsentValue,
} from '@/lib/crm-contact-options';
import type { ConsentDecision, CRMContact, CRMContactStatus } from '@/types/crm';

interface CRMContactProfileCardProps {
  contact: CRMContact;
  openTaskCount: number;
}

function formatHistoryDate(value: string | null): string {
  if (!value) return 'Not yet';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function CRMContactProfileCard({ contact, openTaskCount }: CRMContactProfileCardProps) {
  const router = useRouter();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);

  // Inline Contact Edit state
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState(contact.first_name || '');
  const [editLastName, setEditLastName] = useState(contact.last_name || '');
  const [editPhone, setEditPhone] = useState(contact.phone || '');
  const [editDistrict, setEditDistrict] = useState(
    contact.district || CRM_CONTACT_DEFAULTS.district
  );
  const [editStatus, setEditStatus] = useState<CRMContactStatus>(
    (contact.status as CRMContactStatus) || CRM_CONTACT_DEFAULTS.status
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

  const fullName =
    [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
    contact.email.split('@')[0];
  const statusLabel =
    CRM_CONTACT_STATUS_OPTIONS.find((option) => option.value === contact.status)?.label ??
    contact.status.replace('_', ' ');

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
        if (res.warning) toast.warning(res.warning);
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
        // The version this form was rendered from. Omitting it makes the
        // action's optimistic-concurrency guard treat the edit as based on a
        // never-updated row, so every real contact refuses the save.
        updated_at: contact.updated_at,
      });
      if (res.success) {
        toast.success('Constituent updated');
        if (res.warning) toast.warning(res.warning);
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
    // Compared lowercased: rows written before the normalization fix still hold
    // mixed case (`Choir` next to `choir`), and the server lowercases the whole
    // array on save — so a case-sensitive check here would offer to add a tag
    // the save would immediately merge away.
    if (contact.tags.some((t) => t.toLowerCase() === raw)) {
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
        updated_at: contact.updated_at,
      });
      if (res.success) {
        toast.success(`Tag #${raw} added`);
        if (res.warning) toast.warning(res.warning);
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
      // Case-insensitive like the bulk-remove path on the server: a legacy
      // mixed-case row must go away when its chip is clicked, not survive
      // because the stored capitalisation differs from the chip's.
      const updatedTags = contact.tags.filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase());
      const res = await saveCRMContact({
        id: contact.id,
        email: contact.email,
        tags: updatedTags,
        updated_at: contact.updated_at,
      });
      if (res.success) {
        toast.success(`Tag #${tagToRemove} removed`);
        if (res.warning) toast.warning(res.warning);
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

  return (
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
                    {CRM_CONTACT_DISTRICT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-[10px] font-black uppercase text-muted-foreground">
                <span className="block mb-1">Status</span>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as CRMContactStatus)}
                  className="w-full px-2 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-normal"
                >
                  {CRM_CONTACT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
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
                <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-foreground">
                  {fullName}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">{contact.email}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
                {statusLabel}
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
                  value={crmContactConsentValue(contact.do_not_email)}
                  disabled={consentBusy}
                  onChange={(e) => void handleConsentChange(e.target.value as ConsentDecision)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-50"
                >
                  {CRM_CONTACT_CONSENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.profileLabel}
                    </option>
                  ))}
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
                  {contact.city || CRM_CONTACT_DEFAULTS.city}, {contact.zip_code || 'CA'} &middot;{' '}
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
                  Joined{' '}
                  {new Date(contact.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Contact history
                </div>
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <Send size={15} className="text-blue-500 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    Last outbound:{' '}
                    <strong className="text-foreground">
                      {formatHistoryDate(contact.last_outbound_at)}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <Inbox size={15} className="text-amber-500 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    Last inbound:{' '}
                    <strong className="text-foreground">
                      {formatHistoryDate(contact.last_inbound_at)}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <Activity size={15} className="text-emerald-500 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    Last engaged:{' '}
                    <strong className="text-foreground">
                      {formatHistoryDate(contact.last_engaged_at)}
                    </strong>
                  </span>
                </div>
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

              {openTaskCount > 0 && (
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <CalendarCheck size={15} className="text-amber-500 shrink-0" />
                  <span>
                    <strong className="text-foreground">{openTaskCount}</strong> open follow-up
                    {openTaskCount === 1 ? '' : 's'}
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
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-muted text-foreground rounded-lg text-xs font-medium group/chip"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => void handleRemoveTagInline(tag)}
                        disabled={tagBusy}
                        title={`Remove #${tag}`}
                        className="ml-0.5 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-red-600"
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
