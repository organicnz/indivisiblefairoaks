'use client';

import { Mail } from 'lucide-react';
import { useState } from 'react';
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
    <div className="w-full bg-slate-950 text-white min-h-screen pt-(--header-clearance) pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-4">
            <Mail size={14} className="text-amber-400" />
            <DataPoint as="span" name="contact.hero.eyebrow" initialData={dataPoints}>
              Connect With Organizers
            </DataPoint>
          </div>
          <DataPoint
            name="contact.hero.title"
            as="h1"
            initialData={dataPoints}
            className="text-4xl sm:text-5xl font-black tracking-tight mb-4"
          >
            Contact Indivisible Fair Oaks-Carmichael
          </DataPoint>
          <DataPoint
            name="contact.hero.intro"
            as="p"
            initialData={dataPoints}
            className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed"
          >
            Have a question, want to volunteer, or suggest an action in our community? We’d love to
            hear from you.
          </DataPoint>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-slate-900/90 p-8 sm:p-12 rounded-3xl border border-slate-800 shadow-2xl">
          {status === 'success' && (
            <output
              id="form-success-message"
              className="block mb-8 p-4 bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 rounded-2xl font-bold text-sm tracking-wide text-center"
            >
              <DataPoint name="contact.status.success_msg" as="span" initialData={dataPoints}>
                ✅ Message sent successfully! Our organizing team will be in touch soon.
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
              className="block mb-8 p-4 bg-amber-950/80 border border-amber-500/50 text-amber-200 rounded-2xl font-bold text-sm tracking-wide text-center"
            >
              <DataPoint name="contact.status.partial_copy_msg" as="span" initialData={dataPoints}>
                ⚠️ Message sent to our organizing team! We will be in touch soon.
              </DataPoint>
              <DataPoint
                name="contact.status.partial_copy_detail"
                as="span"
                initialData={dataPoints}
                className="block mt-1 normal-case tracking-normal font-medium text-amber-300"
              >
                The copy to your inbox could not be delivered — but your message reached us and we
                will reply directly.
              </DataPoint>
            </output>
          )}

          {status === 'partial-notify' && (
            <output
              id="form-partial-message"
              className="block mb-8 p-4 bg-amber-950/80 border border-amber-500/50 text-amber-200 rounded-2xl font-bold text-sm tracking-wide text-center"
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
                className="underline font-bold text-amber-300"
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
                className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 ml-1"
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
                className="w-full px-5 py-3.5 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-white placeholder:text-slate-600"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 ml-1"
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
                className="w-full px-5 py-3.5 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-white placeholder:text-slate-600"
              />
            </div>

            <div>
              <label
                htmlFor="message"
                className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 ml-1"
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
                className="w-full px-5 py-3.5 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-white placeholder:text-slate-600 resize-none"
              />
            </div>

            <fieldset className="space-y-3 rounded-xl border border-slate-800 p-4">
              <legend className="px-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                <DataPoint name="contact.form.prefs_legend" as="span" initialData={dataPoints}>
                  Email preferences
                </DataPoint>
              </legend>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="sendCopy"
                  id="sendCopy"
                  className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 accent-amber-500"
                />
                <label
                  htmlFor="sendCopy"
                  className="text-xs font-semibold text-slate-400 tracking-wide cursor-pointer select-none"
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
                  className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 accent-amber-500"
                />
                <label
                  htmlFor="consentToEmail"
                  className="text-xs font-semibold text-slate-300 tracking-wide cursor-pointer select-none"
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
                className="text-[11px] leading-relaxed text-ink-muted-on-dark"
              >
                We never sell or share your address. Leaving the box unticked keeps you out of
                campaign emails — we will still reply to this message.
              </DataPoint>
            </fieldset>

            <button
              type="submit"
              disabled={status === 'loading'}
              aria-busy={status === 'loading'}
              className="w-full bg-blue-600 text-white font-bold rounded-xl py-4 hover:bg-blue-500 transition-all uppercase tracking-wider text-sm shadow-xl hover:shadow-blue-500/20 disabled:opacity-50"
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
          <div className="mt-12 pt-8 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-400">
            <div className="space-y-2">
              <DataPoint
                name="contact.footer.channels_title"
                as="span"
                initialData={dataPoints}
                className="text-amber-400 font-bold uppercase tracking-wider block"
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
                  className="text-blue-400 hover:underline"
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
                  className="text-blue-400 hover:underline"
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
                className="text-amber-400 font-bold uppercase tracking-wider block"
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
                className="text-slate-400"
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
