'use client';

import { ImageIcon, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { CRMMediaLibraryModal } from '@/components/admin/crm/composer/CRMMediaLibraryModal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { type CRMContact, saveCRMContact } from '@/lib/actions/crm';
import { MAX_CONTACT_NOTES_LENGTH } from '@/lib/crm-import';

interface Props {
  contact?: CRMContact;
  isOpen: boolean;
  onClose: () => void;
}

export function CRMContactEditorModal({ contact, isOpen, onClose }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    first_name: contact?.first_name || '',
    last_name: contact?.last_name || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    address: contact?.address || '',
    city: contact?.city || 'Fair Oaks',
    zip_code: contact?.zip_code || '',
    district: contact?.district || 'CA-06',
    status: contact?.status || 'supporter',
    tags: contact?.tags || [],
    notes: contact?.notes || '',
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) {
      toast.error('Email address is required');
      return;
    }

    setLoading(true);
    try {
      const res = await saveCRMContact({
        id: contact?.id,
        email: formData.email,
        first_name: formData.first_name || null,
        last_name: formData.last_name || null,
        phone: formData.phone || null,
        address: formData.address || null,
        city: formData.city || null,
        zip_code: formData.zip_code || null,
        district: formData.district,
        status: formData.status as
          | 'active_volunteer'
          | 'supporter'
          | 'donor'
          | 'choir'
          | 'organizer'
          | 'inactive',
        tags: formData.tags,
        notes: formData.notes || null,
        // Sent only on an edit. On create there is no row to be stale against,
        // and sending `null` would ask the action to match a row whose
        // `updated_at` is not null.
        ...(contact ? { updated_at: baseVersionRef.current } : {}),
      });

      if (!res.success) {
        // A conflict is not a generic failure and gets its own copy: the save was
        // refused deliberately, and "Failed to save contact" tells the volunteer
        // nothing about what to do next.
        if (res.reason === 'conflict') {
          toast.error(res.error || 'Someone else saved this contact while you were editing.');
        } else {
          toast.error(res.error || 'Failed to save contact');
        }
      } else {
        baseVersionRef.current = res.updatedAt ?? null;
        toast.success(contact ? 'Constituent updated' : 'Constituent created');
        router.refresh();
        onClose();
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

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
            Contact details, district, engagement status, and organizer tags.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
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

          {/* A manually created contact starts as "Never asked" — not in any
              broadcast audience and blocked from direct email until opt-in is
              recorded on their profile. Stated here because Create → try to
              email → blocked reads as a broken save otherwise. */}
          {!contact && (
            <p className="text-[11px] font-medium text-muted-foreground bg-surface-muted border border-border/70 rounded-xl px-3.5 py-2.5">
              New constituents start as “Never asked” and won’t receive chapter email until opt-in
              is recorded on their profile.
            </p>
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
                placeholder="Fair Oaks"
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
                <option value="CA-06">CA-06 (Bera / Matsui)</option>
                <option value="CA-03">CA-03 (Kiley / Sierra)</option>
                <option value="CA-07">CA-07</option>
                <option value="Other">Other / Regional</option>
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
              <option value="supporter">Supporter (Standard Member)</option>
              <option value="active_volunteer">Active Volunteer</option>
              <option value="choir">Resistance Choir Member</option>
              <option value="donor">Grassroots Donor</option>
              <option value="organizer">Chapter Organizer / Board</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

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
                className="px-4 py-2 bg-surface-muted hover:bg-surface-muted text-slate-700 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1"
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
              className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-primary text-white hover:bg-primary-light text-xs font-black uppercase tracking-widest rounded-xl shadow-md transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : contact ? 'Save Changes' : 'Create Constituent'}
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
    </Dialog>
  );
}
