'use client';

import { Mail } from 'lucide-react';
import { useState } from 'react';
import { DataPoint } from '@/components/ui/DataPoint';
import { VgpuCivicConstellation } from '@/components/ui/VgpuCivicConstellation';
import { useDataPoints } from '@/hooks/useDataPoints';
import { type ContactResult, type EmailStatus, submitContact } from './actions';

type FormStatus = 'idle' | 'loading' | 'success' | 'partial-copy' | 'partial-notify' | 'error';

export default function ContactPage() {
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [copyStatus, setCopyStatus] = useState<EmailStatus>('not-requested');

  const { dataPoints } = useDataPoints('contact', {
    'contact.hero.eyebrow': 'Connect With Organizers',
    'contact.hero.title': 'Contact Indivisible Fair Oaks-Carmichael',
    'contact.hero.intro':
      'Have a question, want to volunteer, or suggest an action in our community? We’d love to hear from you.',
    'contact.status.success_msg':
      'Message sent successfully! Our organizing team will be in touch soon.',
    'contact.status.copy_sent_prefix': 'A confirmation copy has been sent to',
    'contact.status.partial_copy_msg':
      '⚠️ Message sent to our organizing team! We will be in touch soon.',
    'contact.status.partial_copy_detail':
      'The copy to your inbox could not be delivered — but your message reached us and we will reply directly.',
    'contact.status.partial_notify_msg':
      '⚠️ Message saved, but notification email failed. For an immediate response, please email us directly at',
    'contact.form.name_label': 'Full Name',
    'contact.form.name_placeholder': 'First and last name',
    'contact.form.email_label': 'Email Address',
    'contact.form.email_placeholder': 'you@domain.org',
    'contact.form.message_label': 'Message',
    'contact.form.message_placeholder':
      'Tell us how you would like to get involved, ask a question about our chapter, or join the Resistance Choir...',
    'contact.form.prefs_legend': 'Email preferences',
    'contact.form.send_copy_label': 'Send me a copy of this message for my records',
    'contact.form.consent_label':
      'Yes, add me to chapter email about actions, meetings and volunteer opportunities. Every message carries an unsubscribe link.',
    'contact.form.privacy_notice':
      'We never sell or share your address. Leaving the box unticked keeps you out of campaign emails — we will still reply to this message.',
    'contact.form.submit_btn': 'Send Message',
    'contact.form.submitting_btn': 'Sending Message...',
    'contact.footer.channels_title': 'Direct Email Channels',
    'contact.footer.channels_general_label': 'General:',
    'contact.footer.channels_newsletter_label': 'Newsletter:',
    'contact.footer.gatherings_title': 'Monthly Gatherings',
    'contact.footer.gatherings_schedule': 'First Tuesday of the month (6:30 – 8:00 PM)',
    'contact.footer.gatherings_location': "St. Michael's Episcopal Church, Carmichael, CA",
  });

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
    <div className="w-full bg-background text-foreground min-h-screen pt-(--header-clearance) pb-20 transition-colors duration-300">
      {/* Header Banner with VGPU Constellation Network */}
      <section className="relative overflow-hidden bg-surface-muted border-b border-border text-foreground dark:bg-secondary dark:text-white py-16">
        <VgpuCivicConstellation />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary-ink dark:bg-primary-bright/10 dark:border-primary-on-dark-muted/30 dark:text-primary-on-dark text-xs font-bold uppercase tracking-wider mb-4">
            <Mail size={14} className="text-accent-gold" />
            <DataPoint as="span" name="contact.hero.eyebrow" initialData={dataPoints}>
              Connect With Organizers
            </DataPoint>
          </div>
          <DataPoint
            name="contact.hero.title"
            as="h1"
            initialData={dataPoints}
            className="text-4xl sm:text-5xl font-black tracking-tight mb-4 text-foreground dark:text-white"
          >
            Contact Indivisible Fair Oaks-Carmichael
          </DataPoint>
          <DataPoint
            name="contact.hero.intro"
            as="p"
            initialData={dataPoints}
            className="text-lg text-muted-foreground dark:text-ink-on-dark max-w-2xl mx-auto leading-relaxed"
          >
            Have a question, want to volunteer, or suggest an action in our community? We’d love to
            hear from you.
          </DataPoint>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-surface-card/90 p-8 sm:p-12 rounded-3xl border border-border dark:border-white/10 shadow-2xl backdrop-blur-md">
          {status === 'success' && (
            <output
              id="form-success-message"
              className="block mb-8 p-4 bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 rounded-2xl font-bold text-sm tracking-wide text-center"
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
              className="block mb-8 p-4 bg-amber-950/80 border border-accent-gold/50 text-amber-200 rounded-2xl font-bold text-sm tracking-wide text-center"
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
              className="block mb-8 p-4 bg-amber-950/80 border border-accent-gold/50 text-amber-200 rounded-2xl font-bold text-sm tracking-wide text-center"
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
              className="mb-8 p-4 bg-rose-950/80 border border-rose-500/50 text-rose-200 rounded-2xl font-bold text-sm tracking-wide text-center"
            >
              ❌ {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" aria-describedby={statusMessageId}>
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
                name="message"
                id="message"
                rows={5}
                required
                placeholder={
                  dataPoints['contact.form.message_placeholder'] ||
                  'Tell us how you would like to get involved, ask a question about our chapter, or join the Resistance Choir...'
                }
                className="w-full px-5 py-3.5 bg-surface-muted border border-border dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary dark:focus:ring-primary-bright focus:border-transparent outline-none transition-all font-medium text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-ink-muted-on-dark resize-none"
              />
            </div>

            <fieldset className="space-y-3 rounded-xl border border-border dark:border-white/10 p-4 bg-surface-muted/50 dark:bg-white/[0.02]">
              <legend className="px-2 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground dark:text-ink-muted-on-dark">
                <DataPoint name="contact.form.prefs_legend" as="span" initialData={dataPoints}>
                  Email preferences
                </DataPoint>
              </legend>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="sendCopy"
                  id="sendCopy"
                  className="mt-1 h-4 w-4 rounded border-border dark:border-white/20 bg-surface-card accent-amber-500"
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
                  className="mt-1 h-4 w-4 rounded border-border dark:border-white/20 bg-surface-card accent-amber-500"
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
              className="w-full bg-primary-bright text-white font-bold rounded-xl py-4 hover:bg-primary transition-all uppercase tracking-wider text-sm shadow-xl hover:shadow-primary/20 disabled:opacity-50"
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

          {/* Chapter Contacts Footer */}
          <div className="mt-12 pt-8 border-t border-border dark:border-white/10 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-muted-foreground dark:text-ink-muted-on-dark">
            <div className="space-y-2">
              <DataPoint
                name="contact.footer.channels_title"
                as="span"
                initialData={dataPoints}
                className="text-primary-ink dark:text-primary-on-dark font-bold uppercase tracking-wider block"
              >
                Direct Email Channels
              </DataPoint>
              <p>
                <strong>
                  <DataPoint
                    name="contact.footer.channels_general_label"
                    as="span"
                    initialData={dataPoints}
                  >
                    General:
                  </DataPoint>
                </strong>{' '}
                <a
                  href="mailto:contact@indivisiblefairoaks.org"
                  className="text-primary-ink dark:text-primary-on-dark-muted hover:underline font-semibold"
                >
                  contact@indivisiblefairoaks.org
                </a>
              </p>
              <p>
                <strong>
                  <DataPoint
                    name="contact.footer.channels_newsletter_label"
                    as="span"
                    initialData={dataPoints}
                  >
                    Newsletter:
                  </DataPoint>
                </strong>{' '}
                <a
                  href="mailto:subscribe@indivisiblefairoaks.org"
                  className="text-primary-ink dark:text-primary-on-dark-muted hover:underline font-semibold"
                >
                  subscribe@indivisiblefairoaks.org
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <DataPoint
                name="contact.footer.gatherings_title"
                as="span"
                initialData={dataPoints}
                className="text-primary-ink dark:text-primary-on-dark font-bold uppercase tracking-wider block"
              >
                Monthly Gatherings
              </DataPoint>
              <DataPoint name="contact.footer.gatherings_schedule" as="p" initialData={dataPoints}>
                First Tuesday of the month (6:30 – 8:00 PM)
              </DataPoint>
              <DataPoint
                name="contact.footer.gatherings_location"
                as="p"
                initialData={dataPoints}
                className="text-muted-foreground dark:text-ink-on-dark"
              >
                St. Michael&apos;s Episcopal Church, Carmichael, CA
              </DataPoint>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
