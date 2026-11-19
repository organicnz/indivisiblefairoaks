'use client';

import { useEffect, useRef, useState } from 'react';
import { DataPoint } from '@/components/ui/DataPoint';
import { type ContactResult, type EmailStatus, submitContact } from '@/app/contact/actions';

type FormStatus = 'idle' | 'loading' | 'success' | 'partial-copy' | 'partial-notify' | 'error';

type ContactFormProps = {
  dataPoints: Record<string, string>;
};

export function ContactForm({ dataPoints }: ContactFormProps) {
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [copyStatus, setCopyStatus] = useState<EmailStatus>('not-requested');
  const messageRef = useRef<HTMLTextAreaElement>(null);

  // The homepage's workgroup quick hit arrives with `topic=workgroup`. Start
  // the message with that context so the volunteer does not have to guess what
  // a workgroup is or retype the request. Never overwrite text the visitor has
  // already entered (for example after a failed submit).
  useEffect(() => {
    const topic = new URLSearchParams(window.location.search).get('topic');
    if (topic === 'workgroup' && messageRef.current && !messageRef.current.value) {
      messageRef.current.value =
        'I’d like to join a chapter workgroup. Please let me know which groups need help and how to get started.';
    }
  }, []);

  const statusMessageId =
    status === 'success'
      ? 'form-success-message'
      : status === 'partial-copy' || status === 'partial-notify'
        ? 'form-partial-message'
        : status === 'error'
          ? 'form-error-message'
          : undefined;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('loading');

    const formData = new FormData(e.currentTarget);
    setSenderEmail(String(formData.get('email') ?? ''));
    setCopyStatus('not-requested');
    const result: ContactResult = await submitContact(formData);

    if ('error' in result) {
      setErrorMessage(result.error);
      setStatus('error');
      return;
    }

    if (result.emailStatus === 'failed') {
      setStatus('partial-notify');
    } else if (result.copyStatus === 'failed') {
      setStatus('partial-copy');
    } else {
      setCopyStatus(result.copyStatus);
      setStatus('success');
      (e.target as HTMLFormElement).reset();
    }
  };

  return (
          <div id="contact-form" className="scroll-mt-28">
            <h2 className="font-display text-3xl font-semibold tracking-[-0.03em]">Send a message</h2>
            <p className="mt-2 mb-8 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Messages are read by chapter volunteers. For urgent voter assistance, use the county
              and election-protection hotlines on the voter information page.
            </p>
          {status === 'success' && (
            <output
              id="form-success-message"
              className="mb-8 block border border-emerald-700/40 bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-200"
            >
              <DataPoint name="contact.status.success_msg" as="span" initialData={dataPoints}>
                Message sent successfully! Our organizing team will be in touch soon.
              </DataPoint>
              {senderEmail && copyStatus === 'sent' && (
                <span className="block mt-1 normal-case tracking-normal font-medium text-emerald-300">
                  <DataPoint
                    name="contact.status.copy_sent_prefix"
                    as="span"
                    initialData={dataPoints}
                  >
                    A confirmation copy has been sent to
                  </DataPoint>{' '}
                  {senderEmail}.
                </span>
              )}
            </output>
          )}

          {status === 'partial-copy' && (
            <output
              id="form-partial-message"
              className="mb-8 block border border-amber-700/40 bg-amber-50 p-4 text-center text-sm font-semibold text-amber-950 dark:bg-amber-950/50 dark:text-amber-100"
            >
              <DataPoint name="contact.status.partial_copy_msg" as="span" initialData={dataPoints}>
                ⚠️ Message sent to our organizing team! We will be in touch soon.
              </DataPoint>
              <DataPoint
                name="contact.status.partial_copy_detail"
                as="span"
                initialData={dataPoints}
                className="block mt-1 normal-case tracking-normal font-medium text-accent-gold"
              >
                The copy to your inbox could not be delivered — but your message reached us and we
                will reply directly.
              </DataPoint>
            </output>
          )}

          {status === 'partial-notify' && (
            <output
              id="form-partial-message"
              className="mb-8 block border border-amber-700/40 bg-amber-50 p-4 text-center text-sm font-semibold text-amber-950 dark:bg-amber-950/50 dark:text-amber-100"
            >
              <DataPoint
                name="contact.status.partial_notify_msg"
                as="span"
                initialData={dataPoints}
              >
                ⚠️ Message saved, but notification email failed. For an immediate response, please
                email us directly at
              </DataPoint>{' '}
              <a
                href="mailto:contact@indivisiblefairoaks.org"
                className="underline font-bold text-accent-gold"
              >
                contact@indivisiblefairoaks.org
              </a>
              .
            </output>
          )}

          {status === 'error' && (
            <div
              id="form-error-message"
              role="alert"
              className="mb-8 border border-rose-700/40 bg-rose-50 p-4 text-center text-sm font-semibold text-rose-950 dark:bg-rose-950/50 dark:text-rose-100"
            >
              ❌ {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="civic-form space-y-6" aria-describedby={statusMessageId}>
            {/* Honeypot field for anti-spam */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="website">Leave this field empty</label>
              <input type="text" name="website" id="website" tabIndex={-1} autoComplete="off" />
            </div>

            <div>
              <label
                htmlFor="name"
                className="block text-xs font-bold text-foreground/80 dark:text-ink-on-dark uppercase tracking-wider mb-2 ml-1"
              >
                <DataPoint name="contact.form.name_label" as="span" initialData={dataPoints}>
                  Full Name
                </DataPoint>
              </label>
              <input
                type="text"
                name="name"
                id="name"
                required
                placeholder={dataPoints['contact.form.name_placeholder'] || 'First and last name'}
                className="w-full px-5 py-3.5 bg-surface-muted border border-border dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary dark:focus:ring-primary-bright focus:border-transparent outline-none transition-all font-medium text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-ink-muted-on-dark"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold text-foreground/80 dark:text-ink-on-dark uppercase tracking-wider mb-2 ml-1"
              >
                <DataPoint name="contact.form.email_label" as="span" initialData={dataPoints}>
                  Email Address
                </DataPoint>
              </label>
              <input
                type="email"
                name="email"
                id="email"
                required
                autoComplete="email"
                inputMode="email"
                spellCheck={false}
                placeholder={dataPoints['contact.form.email_placeholder'] || 'you@domain.org'}
                className="w-full px-5 py-3.5 bg-surface-muted border border-border dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary dark:focus:ring-primary-bright focus:border-transparent outline-none transition-all font-medium text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-ink-muted-on-dark"
              />
            </div>

            <div>
              <label
                htmlFor="message"
                className="block text-xs font-bold text-foreground/80 dark:text-ink-on-dark uppercase tracking-wider mb-2 ml-1"
              >
                <DataPoint name="contact.form.message_label" as="span" initialData={dataPoints}>
                  Message
                </DataPoint>
              </label>
              <textarea
                ref={messageRef}
                name="message"
                id="message"
                rows={5}
                required
                placeholder={
                  dataPoints['contact.form.message_placeholder'] ||
                  'Tell us how you would like to get involved, ask a question about our chapter, or join the Resistance Choir...'
                }
                className="w-full resize-none border border-border bg-surface-muted px-5 py-3.5 font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <fieldset className="space-y-3 rounded-xl border border-border dark:border-white/10 p-4 bg-surface-muted/50 dark:bg-white/[0.02]">
              <legend className="px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                <DataPoint name="contact.form.prefs_legend" as="span" initialData={dataPoints}>
                  Email preferences
                </DataPoint>
              </legend>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="sendCopy"
                  id="sendCopy"
                  className="mt-1 h-4 w-4 rounded border-border dark:border-white/20 bg-surface-card accent-primary"
                />
                <label
                  htmlFor="sendCopy"
                  className="text-xs font-semibold text-foreground/80 dark:text-ink-on-dark tracking-wide cursor-pointer select-none"
                >
                  <DataPoint name="contact.form.send_copy_label" as="span" initialData={dataPoints}>
                    Send me a copy of this message for my records
                  </DataPoint>
                </label>
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="consentToEmail"
                  id="consentToEmail"
                  className="mt-1 h-4 w-4 rounded border-border dark:border-white/20 bg-surface-card accent-primary"
                />
                <label
                  htmlFor="consentToEmail"
                  className="text-xs font-semibold text-foreground dark:text-ink-on-dark tracking-wide cursor-pointer select-none"
                >
                  <DataPoint name="contact.form.consent_label" as="span" initialData={dataPoints}>
                    Yes, add me to chapter email about actions, meetings and volunteer
                    opportunities. Every message carries an unsubscribe link.
                  </DataPoint>
                </label>
              </div>

              <DataPoint
                name="contact.form.privacy_notice"
                as="p"
                initialData={dataPoints}
                className="text-[11px] leading-relaxed text-muted-foreground dark:text-ink-muted-on-dark"
              >
                We never sell or share your address. Leaving the box unticked keeps you out of
                campaign emails — we will still reply to this message.
              </DataPoint>
            </fieldset>

            <button
              type="submit"
              disabled={status === 'loading'}
              aria-busy={status === 'loading'}
              className="min-h-11 w-full border border-primary bg-primary py-4 text-sm font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {status === 'loading' ? (
                <DataPoint name="contact.form.submitting_btn" as="span" initialData={dataPoints}>
                  Sending Message...
                </DataPoint>
              ) : (
                <DataPoint name="contact.form.submit_btn" as="span" initialData={dataPoints}>
                  Send Message
                </DataPoint>
              )}
            </button>
          </form>
          </div>
  );
}
