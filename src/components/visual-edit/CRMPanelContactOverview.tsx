'use client';

import {
  Check,
  Copy,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  Plus,
  Tag,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { consentLabel } from '@/lib/crm-filters';
import { CONSENT_COLORS } from '@/components/visual-edit/crm-panel-styles';
import type { CRMContact } from '@/types/unified';

interface CRMPanelContactOverviewProps {
  selectedContact: CRMContact;
  copiedField: string | null;
  handleCopy: (text: string, label: string) => void;
  setSelectedContact: (contact: CRMContact | null) => void;
  setDistrictFilter: (district: string) => void;
  setSelectedTag: (tag: string) => void;
  setPage: (page: number) => void;
  consentOptions: Array<{ value: 'opted_in' | 'opted_out' | 'unasked'; label: string }>;
  handleSetConsent: (id: string, consent: 'opted_in' | 'opted_out' | 'unasked') => void;
  loading: boolean;
  isAddingTag: boolean;
  setIsAddingTag: (adding: boolean) => void;
  newTagInput: string;
  setNewTagInput: (value: string) => void;
  handleAddTag: (tag: string) => void;
  handleRemoveTag: (tag: string) => void;
  children: ReactNode;
}

export function CRMPanelContactOverview({
  selectedContact,
  copiedField,
  handleCopy,
  setSelectedContact,
  setDistrictFilter,
  setSelectedTag,
  setPage,
  consentOptions,
  handleSetConsent,
  loading,
  isAddingTag,
  setIsAddingTag,
  newTagInput,
  setNewTagInput,
  handleAddTag,
  handleRemoveTag,
  children,
}: CRMPanelContactOverviewProps) {
  return (
      <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
        {/* Contact Details */}
        <div className="grid gap-3 sm:grid-cols-2">
          {selectedContact.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone size={14} className="text-muted-foreground shrink-0" />
              <span>{selectedContact.phone}</span>
              <button
                type="button"
                onClick={() => {
                  if (selectedContact.phone) {
                    handleCopy(selectedContact.phone, 'phone');
                  }
                }}
                title="Copy phone number"
                aria-label="Copy phone"
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {copiedField === 'phone' ? (
                  <Check size={13} className="text-emerald-500" />
                ) : (
                  <Copy size={13} />
                )}
              </button>
              <a
                href={`tel:${selectedContact.phone}`}
                title="Call phone number"
                aria-label="Call phone"
                className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
              >
                <Phone size={13} />
              </a>
            </div>
          )}
          {selectedContact.address && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin size={14} className="text-muted-foreground shrink-0" />
              <span className="truncate">
                {selectedContact.address}, {selectedContact.city}{' '}
                {selectedContact.zip_code}
              </span>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${selectedContact.address}, ${selectedContact.city || ''} ${selectedContact.zip_code || ''}`
                )}`}
                target="_blank"
                rel="noreferrer"
                title="View on Google Maps"
                aria-label="View on Google Maps"
                className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
              >
                <ExternalLink size={13} />
              </a>
            </div>
          )}
          {selectedContact.district && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin size={14} className="text-muted-foreground shrink-0" />
              <span>
                District:{' '}
                <button
                  type="button"
                  onClick={() => {
                    setDistrictFilter(selectedContact.district ?? '');
                    setSelectedContact(null);
                    setPage(1);
                  }}
                  className="font-semibold text-primary hover:text-primary-light hover:underline inline-flex items-center gap-1"
                  title={`Filter directory by district ${selectedContact.district}`}
                  aria-label={`Filter directory by district ${selectedContact.district}`}
                >
                  <span>{selectedContact.district}</span>
                </button>
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Mail size={14} className="text-muted-foreground shrink-0" />
            <span>Source: {selectedContact.source}</span>
          </div>
          {selectedContact.total_donated_cents &&
            selectedContact.total_donated_cents > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Tag size={14} className="text-muted-foreground shrink-0" />
                <span>
                  Donated: ${(selectedContact.total_donated_cents / 100).toFixed(2)}
                </span>
              </div>
            )}
          <div className="sm:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Tag size={12} />
                <span>Tags ({selectedContact.tags.length})</span>
              </span>
              {!isAddingTag && (
                <button
                  type="button"
                  onClick={() => setIsAddingTag(true)}
                  className="text-xs font-bold text-primary hover:text-primary-light transition-colors inline-flex items-center gap-1"
                >
                  <Plus size={11} /> Add Tag
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              {selectedContact.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-muted border border-border text-xs font-semibold text-foreground group"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTag(tag);
                      setPage(1);
                      toast.info(`Filtered by tag #${tag}`);
                    }}
                    className="hover:text-primary hover:underline transition-colors flex items-center gap-1 cursor-pointer"
                    title={`Filter constituents by #${tag}`}
                    aria-label={`Filter constituents by tag ${tag}`}
                  >
                    <span>#{tag}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    title={`Remove tag ${tag}`}
                    aria-label={`Remove tag ${tag}`}
                    className="text-muted-foreground hover:text-rose-400 transition-colors"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              {isAddingTag && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddTag(newTagInput);
                  }}
                  className="inline-flex items-center gap-1"
                >
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    placeholder="New tag…"
                    autoFocus
                    className="px-2 py-0.5 text-xs rounded-lg border border-primary bg-background text-foreground focus:outline-none w-28"
                  />
                  <button
                    type="submit"
                    aria-label="Add tag"
                    className="p-1 rounded bg-primary text-white text-xs font-bold hover:bg-primary-light"
                    title="Add tag"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingTag(false);
                      setNewTagInput('');
                    }}
                    className="p-1 rounded text-muted-foreground hover:text-foreground"
                    title="Cancel"
                    aria-label="Cancel adding tag"
                  >
                    <X size={12} />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Consent Control */}
        <div className="border-t border-border pt-4">
          <h4 className="font-bold text-sm mb-2">Email Consent</h4>
          <div className="flex flex-wrap gap-2">
            {consentOptions.map((opt) => {
              const currentConsent = consentLabel(selectedContact.do_not_email);
              const isActive = currentConsent === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => handleSetConsent(selectedContact.id, opt.value)}
                  disabled={loading}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? `${CONSENT_COLORS[opt.value]} ring-2 ring-offset-2 ring-offset-background`
                      : 'bg-muted text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

      {children}
    </div>
  );
}
