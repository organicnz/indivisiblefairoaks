'use client';

import { ArrowLeft, Check, Copy, Mail, MessageSquare, PenLine } from 'lucide-react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import {
  CONSENT_COLORS,
  CONSENT_OPTIONS,
  STATUS_COLORS,
} from '@/components/visual-edit/crm-panel-styles';
import { consentLabel } from '@/lib/crm-filters';
import type { CRMContact, CRMContactStatus } from '@/types/unified';

interface CRMPanelContactHeaderProps {
  selectedContact: CRMContact;
  copiedField: string | null;
  onCopy: (text: string, label: string) => void;
  onBack: () => void;
  onSetStatus: (status: CRMContactStatus) => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
}

export function CRMPanelContactHeader({
  selectedContact,
  copiedField,
  onCopy,
  onBack,
  onSetStatus,
  onEdit,
  onDelete,
}: CRMPanelContactHeaderProps) {
  return (
    <div className="p-4 border-b border-border">
      <div className="md:hidden mb-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-muted/50 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back to constituents"
        >
          <ArrowLeft size={13} />
          <span>Back to constituents</span>
        </button>
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-black uppercase tracking-tight text-lg text-foreground">
            {selectedContact.first_name} {selectedContact.last_name}
          </h3>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-muted-foreground text-sm font-medium">
              {selectedContact.email}
            </span>
            <button
              type="button"
              onClick={() => onCopy(selectedContact.email, 'email')}
              title="Copy email address"
              aria-label="Copy email"
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {copiedField === 'email' ? (
                <Check size={13} className="text-emerald-500" />
              ) : (
                <Copy size={13} />
              )}
            </button>
            <a
              href={`mailto:${selectedContact.email}`}
              title="Send email via default client"
              aria-label="Send email"
              className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
            >
              <Mail size={13} />
            </a>
            <a
              href={`/admin/crm/broadcasts?recipient=${encodeURIComponent(selectedContact.email)}`}
              target="_blank"
              rel="noreferrer"
              title="Compose broadcast in CRM Studio"
              aria-label="Compose broadcast"
              className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
            >
              <MessageSquare size={13} />
            </a>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <select
              value={selectedContact.status}
              onChange={(e) => onSetStatus(e.target.value as CRMContactStatus)}
              aria-label="Update constituent status"
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border border-border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-gold ${
                STATUS_COLORS[selectedContact.status] || 'bg-muted text-muted-foreground'
              }`}
            >
              <option value="active_volunteer">Active Volunteer</option>
              <option value="supporter">Supporter</option>
              <option value="donor">Donor</option>
              <option value="choir">Choir</option>
              <option value="organizer">Organizer</option>
              <option value="inactive">Inactive</option>
            </select>
            {CONSENT_OPTIONS.map((opt) => {
              const currentConsent = consentLabel(selectedContact.do_not_email);
              return (
                <span
                  key={opt.value}
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    currentConsent === opt.value
                      ? CONSENT_COLORS[opt.value]
                      : 'bg-muted/50 text-muted-foreground'
                  }`}
                >
                  {opt.value === 'opted_in'
                    ? '✓ Opted in'
                    : opt.value === 'opted_out'
                      ? '✗ Opted out'
                      : '? Never asked'}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-light transition-colors shadow-xs"
          >
            <PenLine size={12} className="mr-1" /> Edit
          </button>
          <ConfirmAction
            label="Delete constituent"
            message={`Delete "${selectedContact.first_name} ${selectedContact.last_name}"? This cannot be undone.`}
            confirmLabel="Delete"
            danger
            onConfirm={() => onDelete(selectedContact.id)}
            idleClassName="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition-colors"
          >
            <span className="hidden sm:inline">Delete</span>
          </ConfirmAction>
        </div>
      </div>
    </div>
  );
}
