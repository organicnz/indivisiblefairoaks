'use client';

import { Send } from 'lucide-react';
import type { FormEvent } from 'react';
import type { CRMContact } from '@/types/crm';

interface CRMContactEmailTabProps {
  contact: CRMContact;
  fullName: string;
  emailSubject: string;
  setEmailSubject: (value: string) => void;
  emailMessage: string;
  setEmailMessage: (value: string) => void;
  sendingEmail: boolean;
  handleSendEmail: (e: FormEvent) => void;
}

export function CRMContactEmailTab({
  contact,
  fullName,
  emailSubject,
  setEmailSubject,
  emailMessage,
  setEmailMessage,
  sendingEmail,
  handleSendEmail,
}: CRMContactEmailTabProps) {
  return (
      <div className="bg-surface-card rounded-2xl border border-border shadow-xs p-6 space-y-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary dark:text-primary-on-dark">
            Resend Email Engine
          </span>
          <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
            Direct outreach to {fullName}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sends directly to <strong className="text-foreground">{contact.email}</strong> using
            the Sensory Luxury email template from{' '}
            <code className="text-primary dark:text-primary-on-dark font-bold">
              contact@indivisiblefairoaks.org
            </code>
            .
          </p>
          {contact.do_not_email === true && (
            <p className="mt-2 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              This contact is marked do-not-email — sending is blocked until consent is restored.
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
  );
}
