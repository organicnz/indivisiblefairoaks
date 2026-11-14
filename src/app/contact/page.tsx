'use client';

import { Mail } from 'lucide-react';
import { useState } from 'react';
import {
  MASTHEAD_INTRO,
  MASTHEAD_TITLE,
  PageMasthead,
} from '@/components/layout/PageMasthead';
import { DataPoint } from '@/components/ui/DataPoint';
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
    <div className="civic-page w-full min-h-screen bg-background pb-20 text-foreground pt-(--header-clearance) transition-colors duration-300">
      <PageMasthead
        icon={Mail}
        eyebrow={
          <DataPoint as="span" name="contact.hero.eyebrow" initialData={dataPoints}>
            Connect With Organizers
          </DataPoint>
        }
        title={
          <DataPoint
            name="contact.hero.title"
            as="h1"
            initialData={dataPoints}
            className={MASTHEAD_TITLE}
          >
            Contact Indivisible Fair Oaks-Carmichael
          </DataPoint>
        }
        intro={
          <DataPoint
            name="contact.hero.intro"
            as="p"
            initialData={dataPoints}
            className={MASTHEAD_INTRO}
          >
            Have a question, want to volunteer, or suggest an action in our community? We’d love to
            hear from you.
          </DataPoint>
        }
      />

      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 border border-border bg-surface-card p-6 sm:p-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
          <div>
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

          {/* Chapter Contacts Footer */}
          <aside aria-label="Direct contact and meeting details" className="border-t border-border pt-8 lg:border-l lg:border-t-0 lg:pl-8">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em]">Direct channels</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-1">
            <div className="space-y-2">
              <DataPoint
                name="contact.footer.channels_title"
                as="h3"
                initialData={dataPoints}
                className="civic-meta block"
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
                as="h3"
                initialData={dataPoints}
                className="civic-meta block"
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
          </aside>
        </div>
      </div>
    </div>
  );
}
