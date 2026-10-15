'use client';

import { Mail } from 'lucide-react';
import { useState } from 'react';
import { useDataPoints } from '@/hooks/useDataPoints';
import { type ContactResult, type EmailStatus, submitContact } from './actions';

type FormStatus = 'idle' | 'loading' | 'success' | 'partial-copy' | 'partial-notify' | 'error';

export default function ContactPage() {
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [copyStatus, setCopyStatus] = useState<EmailStatus>('not-requested');

  const { get: getContactData } = useDataPoints('contact', {
    'contact.hero.eyebrow': 'Connect With Organizers',
    'contact.hero.title': 'Contact Indivisible Fair Oaks-Carmichael',
    'contact.hero.intro':
      'Have a question, want to volunteer, or suggest an action in our community? We’d love to hear from you.',
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
          <div
            data-data-point="contact.hero.eyebrow"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-4"
          >
            <Mail size={14} className="text-amber-400" />
            <span>{getContactData('contact.hero.eyebrow', 'Connect With Organizers')}</span>
          </div>
          <h1
            data-data-point="contact.hero.title"
            className="text-4xl sm:text-5xl font-black tracking-tight mb-4"
          >
            {getContactData('contact.hero.title', 'Contact Indivisible Fair Oaks-Carmichael')}
          </h1>
          <p
            data-data-point="contact.hero.intro"
            className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed"
          >
            {getContactData(
              'contact.hero.intro',
              'Have a question, want to volunteer, or suggest an action in our community? We’d love to hear from you.'
            )}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-slate-900/90 p-8 sm:p-12 rounded-3xl border border-slate-800 shadow-2xl">
          {status === 'success' && (
            <output
              id="form-success-message"
              className="block mb-8 p-4 bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 rounded-2xl font-bold text-sm tracking-wide text-center"
            >
              ✅ Message sent successfully! Our organizing team will be in touch soon.
              {senderEmail && copyStatus === 'sent' && (
                <span className="block mt-1 normal-case tracking-normal font-medium text-emerald-300">
                  A confirmation copy has been sent to {senderEmail}.
                </span>
              )}
            </output>
          )}

          {status === 'partial-copy' && (
            <output
              id="form-partial-message"
              className="block mb-8 p-4 bg-amber-950/80 border border-amber-500/50 text-amber-200 rounded-2xl font-bold text-sm tracking-wide text-center"
            >
              ⚠️ Message sent to our organizing team! We will be in touch soon.
              <span className="block mt-1 normal-case tracking-normal font-medium text-amber-300">
                The copy to your inbox could not be delivered — but your message reached us and we
                will reply directly.
              </span>
            </output>
          )}

          {status === 'partial-notify' && (
            <output
              id="form-partial-message"
              className="block mb-8 p-4 bg-amber-950/80 border border-amber-500/50 text-amber-200 rounded-2xl font-bold text-sm tracking-wide text-center"
            >
              ⚠️ Message saved, but notification email failed. For an immediate response, please
              email us directly at{' '}
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
                Full Name
              </label>
              <input
                type="text"
                name="name"
                id="name"
                required
                placeholder="First and last name"
                className="w-full px-5 py-3.5 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-white placeholder:text-slate-600"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 ml-1"
              >
                Email Address
              </label>
              <input
                type="email"
                name="email"
                id="email"
                required
                autoComplete="email"
                inputMode="email"
                spellCheck={false}
                placeholder="you@domain.org"
                className="w-full px-5 py-3.5 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-white placeholder:text-slate-600"
              />
            </div>

            <div>
              <label
                htmlFor="message"
                className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 ml-1"
              >
                Message
              </label>
              <textarea
                name="message"
                id="message"
                rows={5}
                required
                placeholder="Tell us how you would like to get involved, ask a question about our chapter, or join the Resistance Choir..."
                className="w-full px-5 py-3.5 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-white placeholder:text-slate-600 resize-none"
              />
            </div>

            {/*
              Two checkboxes, and the distinction between them is the point.

              `sendCopy` is transactional: a copy of *this message*, for the
              sender's own records. It is not consent, and it never was — but it
              was the only checkbox on the form, and the CRM had no way to ask for
              marketing email at all. So every contact who wrote once was in the
              chapter's next broadcast audience.

              This one is the actual ask. Unticked is the answer too: it records a
              decline rather than an unknown, because the resident was shown the
              box and did not tick it. Either way they are excluded from
              broadcasts, and the only way in is to tick this.

              Separate control, separate sentence, no bundling. The consent copy
              says what they would receive and who would see their address.
            */}
            <fieldset className="space-y-3 rounded-xl border border-slate-800 p-4">
              <legend className="px-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                Email preferences
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
                  Send me a copy of this message for my records
                </label>
              </div>

              {/*
   Two separate checkboxes, and they have to stay separate.

   `sendCopy` is transactional: a reply to this one message. `consentToEmail` is
   marketing: a standing permission to be in future campaign audiences. Collapsing
   them into one box — which is what a single "email me" checkbox invites — means
   the consent that eventually reaches a broadcast audience was never separately
   given, and a resident who wanted a receipt is on a mailing list. That is the
   whole gap this migration closes, expressed as a form field.
*/}
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
                  Yes, add me to chapter email about actions, meetings and volunteer opportunities.
                  Every message carries an unsubscribe link.
                </label>
              </div>

              {/*
   The copy has to be accurate about what the address is used for, because the
   alternative is a promise the code cannot keep.

   It previously read "Your address is only ever used for this". Ticking the box
   above does the opposite of that: it records a standing opt-in that adds the
   address to broadcast audiences, and the address is what a broadcast is sent to.
   An organiser reading a resident's consent record is entitled to believe the
   resident was told what they agreed to.

   So it says the two things that are actually true and are the two things worth
   promising: it is never sold or shared, and leaving the box unticked keeps them
   out of campaign audiences while still getting a reply.

   `text-ink-muted-on-dark`, not `text-slate-500`. The latter is #64748b, which on
   this surface is 3.81:1 — below the 4.5:1 WCAG AA threshold for text at this
   size, and the axe gate in `e2e/a11y.spec.ts` fails on it. The token is #94a3b8:
   7.08:1. Worth naming the direction of that trap: on a *dark* surface the muted
   slate steps get darker, so `slate-500` reads as "muted" by name while sitting
   one step past the line.
*/}

              <p className="text-[11px] leading-relaxed text-ink-muted-on-dark">
                We never sell or share your address. Leaving the box unticked keeps you out of
                campaign emails — we will still reply to this message.
              </p>
            </fieldset>

            <button
              type="submit"
              disabled={status === 'loading'}
              aria-busy={status === 'loading'}
              className="w-full bg-blue-600 text-white font-bold rounded-xl py-4 hover:bg-blue-500 transition-all uppercase tracking-wider text-sm shadow-xl hover:shadow-blue-500/20 disabled:opacity-50"
            >
              {status === 'loading' ? 'Sending Message...' : 'Send Message'}
            </button>
          </form>

          {/* Chapter Contacts Footer */}
          <div className="mt-12 pt-8 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-400">
            <div className="space-y-2">
              <span className="text-amber-400 font-bold uppercase tracking-wider block">
                Direct Email Channels
              </span>
              <p>
                <strong>General:</strong>{' '}
                <a
                  href="mailto:contact@indivisiblefairoaks.org"
                  className="text-blue-400 hover:underline"
                >
                  contact@indivisiblefairoaks.org
                </a>
              </p>
              <p>
                <strong>Newsletter:</strong>{' '}
                <a
                  href="mailto:subscribe@indivisiblefairoaks.org"
                  className="text-blue-400 hover:underline"
                >
                  subscribe@indivisiblefairoaks.org
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-amber-400 font-bold uppercase tracking-wider block">
                Monthly Gatherings
              </span>
              <p>First Tuesday of the month (6:30 – 8:00 PM)</p>
              <p className="text-slate-400">St. Michael&apos;s Episcopal Church, Carmichael, CA</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
