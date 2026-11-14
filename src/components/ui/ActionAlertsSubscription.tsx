'use client';

import { useState, useTransition } from 'react';
import { Mail, Send, CheckCircle2, AlertCircle, Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';
import { subscribeActionAlerts } from '@/app/news/actions';

export interface ActionAlertsSubscriptionProps {
  initialData?: Record<string, string>;
  className?: string;
}

export function ActionAlertsSubscription({ initialData, className = '' }: ActionAlertsSubscriptionProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim() || isPending) return;

    setStatus('idle');
    setFeedbackMessage('');

    const formData = new FormData();
    formData.append('email', email);
    if (name.trim()) formData.append('name', name);

    // Read honeypot if filled by bot
    const honeypotInput = (e.currentTarget.elements.namedItem('website') as HTMLInputElement | null)?.value;
    if (honeypotInput) formData.append('website', honeypotInput);

    startTransition(async () => {
      try {
        const res = await subscribeActionAlerts(formData);
        if ('error' in res) {
          setStatus('error');
          setFeedbackMessage(res.error);
        } else {
          setStatus('success');
          setFeedbackMessage(res.message);
          setEmail('');
          setName('');
        }
      } catch (err) {
        console.error('Subscription error:', err);
        setStatus('error');
        setFeedbackMessage('Something went wrong. Please try again or use the email link below.');
      }
    });
  };

  const handleReset = () => {
    setStatus('idle');
    setFeedbackMessage('');
    setEmail('');
    setName('');
  };

  return (
    <section
      aria-labelledby="action-alerts-headline"
      className={`relative overflow-hidden border-y-2 border-foreground/25 bg-surface-muted p-6 transition-all duration-300 sm:p-8 md:p-10 ${className}`}
    >
      <div className="relative z-10 space-y-6">
        {/* Eyebrow is a ruled kicker, matching the rest of the public pages. */}
        <div className="civic-kicker">
          <Mail size={12} className="shrink-0" />
          <DataPoint initialData={initialData} as="span" name="news.subscribe.badge">
            Direct To Your Inbox
          </DataPoint>
        </div>

        {/* Headline & Description */}
        <div className="space-y-2">
          <DataPoint
            initialData={initialData}
            name="news.subscribe.headline"
            as="h2"
            id="action-alerts-headline"
            className="font-display text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl"
          >
            Subscribe to Action Alerts
          </DataPoint>
          <DataPoint
            initialData={initialData}
            name="news.subscribe.intro"
            as="p"
            className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark max-w-2xl leading-relaxed"
          >
            Receive notifications for upcoming meetings, emergency rapid response rallies, choir
            rehearsal locations, and legislative call-to-action alerts.
          </DataPoint>
        </div>

        {/* State Machine: Success View */}
        {status === 'success' ? (
          <div
            role="status"
            aria-live="polite"
            className="border border-emerald-700/30 bg-emerald-500/10 p-6 sm:p-7 transition-colors"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-emerald-500/20 p-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={24} className="shrink-0" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-foreground dark:text-white text-base">
                    You're Subscribed to Action Alerts!
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark">
                    {feedbackMessage ||
                      "Thank you for joining our grassroots community. We'll keep you updated on rapid response rallies and legislative votes."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-ink-strong dark:text-accent-gold bg-accent-gold/20 hover:bg-accent-gold/30 border border-accent-gold/40 transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
              >
                <Sparkles size={14} />
                Subscribe Another
              </button>
            </div>
          </div>
        ) : (
          /* State Machine: Interactive Form */
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Honeypot field for anti-bot shielding */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              className="sr-only"
              aria-hidden="true"
            />

            {/* Error banner */}
            {status === 'error' && (
              <div
                role="alert"
                aria-live="polite"
                className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs sm:text-sm font-medium text-rose-700 dark:text-rose-300"
              >
                <AlertCircle size={16} className="shrink-0" />
                <span>{feedbackMessage}</span>
              </div>
            )}

            {/* Form Fields: Name (optional) + Email (required) + Submit */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4">
                <label htmlFor="action-alerts-name" className="sr-only">
                  First Name (optional)
                </label>
                <input
                  id="action-alerts-name"
                  type="text"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isPending}
                  placeholder="First name (optional)"
                  maxLength={100}
                  className="w-full px-4 py-3 text-xs sm:text-sm rounded-xl border border-border bg-surface-subtle/80 dark:bg-slate-900/80 text-foreground dark:text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all"
                />
              </div>

              <div className="sm:col-span-5">
                <label htmlFor="action-alerts-email" className="sr-only">
                  Email Address
                </label>
                <input
                  id="action-alerts-email"
                  type="email"
                  name="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isPending}
                  placeholder="Enter your email address..."
                  maxLength={254}
                  className={`w-full px-4 py-3 text-xs sm:text-sm rounded-xl border bg-surface-subtle/80 dark:bg-slate-900/80 text-foreground dark:text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-gold transition-all ${
                    status === 'error' ? 'border-rose-500' : 'border-border'
                  }`}
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={isPending || !email.trim()}
                  className="inline-flex h-full min-h-11 w-full touch-manipulation items-center justify-center gap-2 border border-accent-gold bg-accent-gold px-5 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-strong transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2"
                >
                  {isPending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Subscribing...</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>Subscribe</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Bottom auxiliary toolbar: direct mailto fallback + privacy notice */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-[11px] sm:text-xs text-muted-foreground dark:text-ink-on-dark/70">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-accent-gold shrink-0" />
                <span>We respect your privacy. No spam. One-click unsubscribe anytime.</span>
              </div>

              <div className="shrink-0 flex items-center gap-1">
                <span>Or prefer email client?</span>
                <a
                  href="mailto:subscribe@indivisiblefairoaks.org?subject=Subscribe%20to%20Indivisible%20Fair%20Oaks%20Newsletter"
                  className="inline-flex items-center gap-1 font-bold text-ink-strong dark:text-accent-gold hover:underline underline-offset-4 transition-colors"
                >
                  <DataPoint initialData={initialData} as="span" name="news.subscribe.btn">
                    Email to Subscribe
                  </DataPoint>
                </a>
              </div>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
