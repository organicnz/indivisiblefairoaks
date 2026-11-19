'use client';

import { AlertTriangle, ExternalLink, GitMerge, ImageIcon, Loader2, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CRMMergeModal } from '@/components/admin/crm/CRMMergeModal';
import { CRMMediaLibraryModal } from '@/components/admin/crm/composer/CRMMediaLibraryModal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { findCRMContactByEmail, saveCRMContact, setCRMEmailConsent } from '@/lib/actions/crm';
import {
  CRM_CONTACT_CONSENT_OPTIONS,
  CRM_CONTACT_DEFAULTS,
  CRM_CONTACT_DISTRICT_OPTIONS,
  CRM_CONTACT_EDITOR_STATUS_OPTIONS,
  crmContactConsentValue,
  normalizeCRMEmail,
} from '@/lib/crm-contact-options';
import { MAX_CONTACT_NOTES_LENGTH } from '@/lib/crm-import';
import type { ConsentDecision, CRMContact, CRMContactStatus } from '@/types/crm';

interface Props {
  contact?: CRMContact;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

type ActionResult = { success: boolean; error?: string; reason?: string } | null;

const initialState: ActionResult = null;

function contactDisplayName(value: CRMContact): string {
  return [value.first_name, value.last_name].filter(Boolean).join(' ') || value.email;
}

export function CRMContactEditorModal({ contact, isOpen, onClose, onSaved }: Props) {
  const router = useRouter();
  const [tagInput, setTagInput] = useState('');
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [duplicateContact, setDuplicateContact] = useState<CRMContact | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);

  const [formData, setFormData] = useState({
    first_name: contact?.first_name || '',
    last_name: contact?.last_name || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    address: contact?.address || '',
    city: contact?.city || CRM_CONTACT_DEFAULTS.city,
    zip_code: contact?.zip_code || '',
    district: contact?.district || CRM_CONTACT_DEFAULTS.district,
    status: contact?.status || CRM_CONTACT_DEFAULTS.status,
    tags: contact?.tags || [],
    notes: contact?.notes || '',
    consent: contact
      ? crmContactConsentValue(contact.do_not_email ?? null)
      : ('unasked' as ConsentDecision),
  });

  const originalConsent = contact
    ? crmContactConsentValue(contact.do_not_email ?? null)
    : ('unasked' as ConsentDecision);

  /**
   * The version this edit was based on.
   *
   * Held in a ref, not state: it never changes while the modal is open — it is
   * replaced from each save's response, and the component is re-keyed per contact
   * by its parents. State would invite it into the form's dirty-tracking, and a
   * `useEffect` resetting it on every render is the pattern that silently drops
   * the guard.
   *
   * A successful save adopts the *database's* new `updated_at` rather than a
   * timestamp computed here. The `touch_updated_at` trigger writes the row's
   * version; a second clock disagrees with it by milliseconds, and then this
   * editor's own next save conflicts with itself — which is the exact false
   * positive that teaches people to ignore the conflict message.
   */
  const baseVersionRef = useRef<string | null>(contact?.updated_at ?? null);

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (!trimmed) return;
    if (!formData.tags.includes(trimmed)) {
      setFormData((prev) => ({ ...prev, tags: [...prev.tags, trimmed] }));
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tagToRemove),
    }));
  };

  const handleOpenDuplicate = () => {
    if (!duplicateContact) return;
    onClose();
    router.push(`/admin/crm/${duplicateContact.id}`);
  };

  const handleMergeDuplicate = () => {
    if (!duplicateContact) return;
    setIsMergeOpen(true);
  };

  const handleDuplicateMerged = () => {
    // The merge updates the survivor's version, so this editor's optimistic
    // checkpoint is stale. Close it rather than inviting a save that would be
    // refused as a conflict the moment the organizer pressed Save.
    setDuplicateContact(null);
    onSaved?.();
    onClose();
  };

  async function contactEditorAction(
    _prevState: ActionResult,
    _formData: FormData
  ): Promise<ActionResult> {
    if (!formData.email) {
      toast.error('Email address is required');
      return { success: false, error: 'Email address is required' };
    }

    const normalizedEmail = normalizeCRMEmail(formData.email);
    setDuplicateContact(null);

    // The lookup excludes the row being edited, so an unchanged email is not
    // reported as its own duplicate. Both create and edit go through it before
    // a write; the unique constraint remains the race-condition backstop.
    setCheckingEmail(true);
    try {
      const lookup = await findCRMContactByEmail({
        email: normalizedEmail,
        ...(contact ? { excludeContactId: contact.id } : {}),
      });
      if (lookup.contact) {
        setDuplicateContact(lookup.contact);
        toast.error('That email already belongs to another constituent.');
        return {
          success: false,
          error: 'That email already belongs to another constituent.',
          reason: 'duplicate_email',
        };
      }
    } catch {
      // The preflight is an optimization, never the guarantee. Fall through to
      // the write; the unique constraint still refuses a duplicate, and its
      // 23505 branch returns the existing contact for this same panel.
    } finally {
      setCheckingEmail(false);
    }

    const res = await saveCRMContact({
      id: contact?.id,
      email: normalizedEmail,
      first_name: formData.first_name || null,
      last_name: formData.last_name || null,
      phone: formData.phone || null,
      address: formData.address || null,
      city: formData.city || null,
      zip_code: formData.zip_code || null,
      district: formData.district,
      status: formData.status as CRMContactStatus,
      tags: formData.tags,
      notes: formData.notes || null,
      // Consent is intentionally not sent here; the dedicated action below
      // writes the timeline entry that a profile edit must not bypass.
      // Sent only on an edit. On create there is no row to be stale against,
      // and sending `null` would ask the action to match a row whose
      // `updated_at` is not null.
      ...(contact ? { updated_at: baseVersionRef.current } : {}),
    });

    if (!res.success) {
      // A conflict is not a generic failure and gets its own copy: the save was
      // refused deliberately, and "Failed to save contact" tells the volunteer
      // nothing about what to do next.
      if (res.reason === 'duplicate_email') {
        if (res.duplicateContact) setDuplicateContact(res.duplicateContact);
        toast.error(res.error || 'That email already belongs to another constituent.');
      } else if (res.reason === 'conflict') {
        toast.error(res.error || 'Someone else saved this contact while you were editing.');
      } else {
        toast.error(res.error || 'Failed to save contact');
      }
      return { success: false, error: res.error, reason: res.reason };
    }

    /*
      Consent is deliberately not part of saveCRMContact. A generic profile
      edit has no consent field, so it cannot overwrite it silently; a consent
      change goes through the dedicated action, which writes the same timeline
      entry as the 360/profile controls. The profile write is kept even when the
      consent follow-up fails: the contact must not be reported as unsaved after
      the row has already committed.
    */
    let consentWarning: string | null = null;
    const consentTargetId = contact?.id ?? res.contactId;
    if (formData.consent !== originalConsent) {
      if (!consentTargetId) {
        consentWarning = 'Consent was not updated because the contact id was unavailable.';
      } else {
        try {
          const consentRes = await setCRMEmailConsent({
            contactId: consentTargetId,
            doNotEmail: formData.consent,
          });
          if (!consentRes.success) {
            consentWarning = `Constituent saved, but consent was not updated: ${
              consentRes.error || 'unknown error'
            }`;
          } else if (consentRes.warning) {
            consentWarning = consentRes.warning;
          }
        } catch (err) {
          consentWarning = `Constituent saved, but consent was not updated: ${
            err instanceof Error ? err.message : 'unknown error'
          }`;
        }
      }
    }

    baseVersionRef.current = res.updatedAt ?? null;
    toast.success(contact ? 'Constituent updated' : 'Constituent created');
    if (res.warning) toast.warning(res.warning);
    if (consentWarning) toast.warning(consentWarning);
    onSaved?.();
    router.refresh();
    onClose();
    return { success: true };
  }

  const [, formAction, isPending] = useActionState(contactEditorAction, initialState);
  const busy = isPending || checkingEmail;
  const mergeKeep = contact ?? duplicateContact;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader>
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary dark:text-primary-on-dark">
            Constituent Directory
          </span>
          <DialogTitle id="modal-title">
            {contact ? 'Edit Constituent' : 'Add New Constituent'}
          </DialogTitle>
          <DialogDescription>
            Contact details, district, engagement status, email consent, and organizer tags.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="first_name"
                className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1"
              >
                First Name
              </label>
              <input
                id="first_name"
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData((p) => ({ ...p, first_name: e.target.value }))}
                placeholder="Jane"
                className="w-full px-4 py-2.5 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="last_name"
                className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1"
              >
                Last Name
              </label>
              <input
                id="last_name"
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData((p) => ({ ...p, last_name: e.target.value }))}
                placeholder="Doe"
                className="w-full px-4 py-2.5 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="email"
                className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1"
              >
                Email Address *
              </label>
              <input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => {
                  setFormData((p) => ({ ...p, email: e.target.value }));
                  setDuplicateContact(null);
                }}
                placeholder="jane@example.com"
                className="w-full px-4 py-2.5 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="phone"
                className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1"
              >
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                placeholder="(916) 555-0199"
                className="w-full px-4 py-2.5 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm"
              />
            </div>
          </div>

          {duplicateContact && (
            <div
              role="alert"
              className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-700/70 dark:bg-amber-950/30 dark:text-amber-100"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-black">
                    That email already belongs to {contactDisplayName(duplicateContact)}
                  </p>
                  <p className="mt-0.5 text-xs break-all text-amber-900 dark:text-amber-200">
                    {duplicateContact.email}
                  </p>
                  <p className="mt-1 text-xs">
                    {contact
                      ? 'Open their profile, or merge them into this constituent.'
                      : 'Open their profile, or use Merge to consolidate the duplicate records.'}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleOpenDuplicate}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-950 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
                >
                  <ExternalLink size={13} aria-hidden="true" /> Open existing
                </button>
                <button
                  type="button"
                  onClick={handleMergeDuplicate}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-card px-3 py-2 text-xs font-bold text-amber-950 transition-colors hover:bg-amber-100 dark:border-amber-600 dark:bg-transparent dark:text-amber-100 dark:hover:bg-amber-900/40"
                >
                  <GitMerge size={13} aria-hidden="true" /> Merge duplicate
                </button>
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="address"
              className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1"
            >
              Street Address
            </label>
            <input
              id="address"
              type="text"
              value={formData.address}
              onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
              placeholder="123 Main St"
              className="w-full px-4 py-2.5 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="city"
                className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1"
              >
                City
              </label>
              <input
                id="city"
                type="text"
                value={formData.city}
                onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
                placeholder={CRM_CONTACT_DEFAULTS.city}
                className="w-full px-4 py-2.5 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="zip_code"
                className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1"
              >
                ZIP Code
              </label>
              <input
                id="zip_code"
                type="text"
                value={formData.zip_code}
                onChange={(e) => setFormData((p) => ({ ...p, zip_code: e.target.value }))}
                placeholder="95628"
                className="w-full px-4 py-2.5 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="district"
                className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1"
              >
                Congressional District
              </label>
              <select
                id="district"
                value={formData.district}
                onChange={(e) => setFormData((p) => ({ ...p, district: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm bg-surface-card"
              >
                {CRM_CONTACT_DISTRICT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.editorLabel}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="status"
              className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1"
            >
              Civic Engagement Status
            </label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm bg-surface-card"
            >
              {CRM_CONTACT_EDITOR_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.editorLabel}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="rounded-xl border border-border p-4 space-y-3">
            <legend className="px-1.5 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Email Consent
            </legend>
            <p className="text-xs text-muted-foreground">
              Consent controls chapter email only. <strong>Never asked</strong> and{' '}
              <strong>Opted out</strong> are excluded from broadcasts; only <strong>Agreed</strong>{' '}
              receives chapter email. Changing this is saved as its own contact timeline entry.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {CRM_CONTACT_CONSENT_OPTIONS.map((option) => {
                const checked = formData.consent === option.value;
                return (
                  <label
                    key={option.value}
                    className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs transition-colors ${
                      checked ? 'border-primary bg-primary/5' : 'border-border bg-background'
                    } ${isPending ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                  >
                    <input
                      type="radio"
                      name="email-consent"
                      value={option.value}
                      checked={checked}
                      disabled={isPending}
                      onChange={() => setFormData((prev) => ({ ...prev, consent: option.value }))}
                      className="mt-0.5 accent-primary"
                    />
                    <span className="font-medium leading-snug">{option.profileLabel}</span>
                  </label>
                );
              })}
            </div>
            {!contact ? (
              <p className="text-[11px] font-medium text-muted-foreground bg-surface-muted border border-border/70 rounded-lg px-3 py-2">
                New constituents default to “Never asked” and are excluded from broadcasts. Choosing
                another state records it as a separate consent change after creation, so the
                timeline shows the decision.
              </p>
            ) : formData.consent !== originalConsent ? (
              <p className="text-[11px] font-medium text-primary">
                This consent change will be recorded separately on the contact timeline.
              </p>
            ) : null}
          </fieldset>

          <div>
            <label
              htmlFor="tag-input"
              className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1"
            >
              Interest Tags & Roles
            </label>
            <div className="flex gap-2 mb-2">
              <input
                id="tag-input"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="e.g. postcard-blitz, phone-bank, rally-marshal"
                className="flex-1 px-4 py-2 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-xs"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-surface-muted hover:bg-surface-muted text-foreground rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1"
              >
                <Plus size={14} /> Add Tag
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[28px]">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-full text-xs font-medium"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    aria-label={`Remove tag ${tag}`}
                    className="hover:text-red-600 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="notes"
                className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground"
              >
                Internal Organizer Notes
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
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
              // The server caps this at 5,000 (matching the CSV importer's row
              // budget). Stated here too, because a cap the client cannot see is
              // a 400 after a volunteer has typed a paragraph — and these notes
              // render in the 360 panel and in every directory CSV export.
              maxLength={MAX_CONTACT_NOTES_LENGTH}
              placeholder="Meeting notes, preferred contact times, organizing skills..."
              className="w-full px-4 py-2.5 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary text-sm"
            />
            {formData.notes.length > MAX_CONTACT_NOTES_LENGTH * 0.9 && (
              <p className="mt-1 text-[10px] font-bold text-muted-foreground text-right">
                {formData.notes.length} / {MAX_CONTACT_NOTES_LENGTH}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-6 py-2.5 bg-primary text-white hover:bg-primary-light text-xs font-black uppercase tracking-widest rounded-xl shadow-md transition-colors disabled:opacity-50"
            >
              {checkingEmail ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  Checking email...
                </span>
              ) : isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  Saving...
                </span>
              ) : contact ? (
                'Save Changes'
              ) : (
                'Create Constituent'
              )}
            </button>
          </div>
        </form>

        {isMediaModalOpen && (
          <CRMMediaLibraryModal
            isOpen={isMediaModalOpen}
            onClose={() => setIsMediaModalOpen(false)}
            onSelectMedia={(media) => {
              const alt = media.alt || media.name;
              setFormData((p) => ({
                ...p,
                notes: `${p.notes ? `${p.notes}\n\n` : ''}![${alt}](${media.url})`,
              }));
              toast.success('Media reference inserted into notes');
              setIsMediaModalOpen(false);
            }}
            initialFolder="crm"
          />
        )}
      </DialogContent>

      {isMergeOpen && duplicateContact && mergeKeep && (
        <CRMMergeModal
          keep={mergeKeep}
          isOpen={isMergeOpen}
          onClose={() => setIsMergeOpen(false)}
          initialCandidate={contact ? duplicateContact : null}
          onMerged={handleDuplicateMerged}
        />
      )}
    </Dialog>
  );
}
