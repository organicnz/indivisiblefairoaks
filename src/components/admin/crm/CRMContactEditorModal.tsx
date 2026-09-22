'use client';

import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { type CRMContact, saveCRMContact } from '@/lib/actions/crm';

interface Props {
  contact?: CRMContact;
  isOpen: boolean;
  onClose: () => void;
}

export function CRMContactEditorModal({ contact, isOpen, onClose }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [tagInput, setTagInput] = useState('');

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

  if (!isOpen) return null;

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
      });

      if (!res.success) {
        toast.error(res.error || 'Failed to save contact');
      } else {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-8"
      >
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">
              Constituent Directory
            </span>
            <h2
              id="modal-title"
              className="text-xl font-black uppercase tracking-tight text-secondary"
            >
              {contact ? 'Edit Constituent' : 'Add New Constituent'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-secondary rounded-full hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="first_name"
                className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
              >
                First Name
              </label>
              <input
                id="first_name"
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData((p) => ({ ...p, first_name: e.target.value }))}
                placeholder="Jane"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="last_name"
                className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
              >
                Last Name
              </label>
              <input
                id="last_name"
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData((p) => ({ ...p, last_name: e.target.value }))}
                placeholder="Doe"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="email"
                className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
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
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="phone"
                className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
              >
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                placeholder="(916) 555-0199"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="city"
                className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
              >
                City
              </label>
              <input
                id="city"
                type="text"
                value={formData.city}
                onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
                placeholder="Fair Oaks"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="zip_code"
                className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
              >
                ZIP Code
              </label>
              <input
                id="zip_code"
                type="text"
                value={formData.zip_code}
                onChange={(e) => setFormData((p) => ({ ...p, zip_code: e.target.value }))}
                placeholder="95628"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="district"
                className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
              >
                Congressional District
              </label>
              <select
                id="district"
                value={formData.district}
                onChange={(e) => setFormData((p) => ({ ...p, district: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-sm bg-white"
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
              className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
            >
              Civic Engagement Status
            </label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-sm bg-white"
            >
              <option value="supporter">Supporter (Standard Member)</option>
              <option value="active_volunteer">Active Volunteer</option>
              <option value="choir">Resistance Choir Member</option>
              <option value="donor">Grassroots Donor</option>
              <option value="organizer">Chapter Organizer / Board</option>
              <option value="inactive">Inactive / Unsubscribed</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="tag-input"
              className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
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
                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-xs"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1"
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
                    className="hover:text-red-600 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="notes"
              className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1"
            >
              Internal Organizer Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Meeting notes, preferred contact times, organizing skills..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition-colors"
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
      </div>
    </div>
  );
}
