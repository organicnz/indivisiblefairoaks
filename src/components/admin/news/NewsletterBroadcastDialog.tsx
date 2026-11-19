'use client';

import { AlertTriangle, CheckCircle2, Loader2, Mail, Send, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import type { CivicNewsletterRecord } from '@/lib/actions/civic';
import {
  getCivicNewsletterAudience,
  type NewsletterBroadcastResult,
  sendCivicNewsletterBroadcast,
} from '@/lib/actions/civic-newsletter-broadcast';
import { newsletterPublicationState } from '@/lib/newsletters';

type NewsletterBroadcastDialogProps = {
  newsletter: CivicNewsletterRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Step = 'review' | 'confirm' | 'sent';

export function NewsletterBroadcastDialog({
  newsletter,
  open,
  onOpenChange,
}: NewsletterBroadcastDialogProps) {
  const [audience, setAudience] = useState<{ count: number; excludedCount: number } | null>(null);
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState<Step>('review');
  const [result, setResult] = useState<NewsletterBroadcastResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !newsletter) return;
    let cancelled = false;
    setAudience(null);
    setLoadingAudience(true);
    setStep('review');
    setResult(null);
    setError(null);
    setSending(false);

    void getCivicNewsletterAudience()
      .then((counts) => {
        if (!cancelled) setAudience(counts);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not count the audience.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAudience(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, newsletter]);

  if (!newsletter) return null;

  const scheduled = newsletterPublicationState(newsletter.published_at) === 'scheduled';
  const count = audience?.count ?? 0;
  const canSend = !scheduled && !loadingAudience && count > 0 && !sending;

  const handleSend = async () => {
    if (sending || !canSend) return;
    setSending(true);
    setError(null);
    try {
      const res = await sendCivicNewsletterBroadcast(newsletter.slug);
      if (!res.success) {
        setError(res.error ?? 'The bulletin could not be sent.');
        setStep('review');
        toast.error(res.error ?? 'The bulletin could not be sent.');
        return;
      }
      setResult(res);
      setStep('sent');
      toast.success(`Bulletin queued for ${res.recipientCount ?? count} confirmed subscribers.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The bulletin could not be sent.';
      setError(message);
      setStep('review');
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && sending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden border border-border bg-surface-card p-0 text-foreground">
        <DialogHeader className="shrink-0 border-b border-border bg-surface-muted/50 p-5 pr-16 sm:p-6 sm:pr-16">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary-ink dark:text-primary-on-dark">
              <Mail size={19} aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="font-display text-2xl tracking-[-0.03em]">
                Email this bulletin
              </DialogTitle>
              <DialogDescription className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                {newsletter.title} &middot; {newsletter.date_label}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 border border-rose-300 bg-rose-50 p-3 text-xs leading-relaxed text-rose-900 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-100"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          {step === 'sent' && result ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 size={24} aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  Queued for {result.recipientCount ?? count} confirmed subscribers
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  The campaign is in the CRM broadcast log with delivery progress and a
                  per-recipient record. A second send of this bulletin is blocked by its source
                  slug.
                </p>
              </div>
              {result.warning ? (
                <p className="rounded-sm border border-amber-300 bg-amber-50 p-3 text-left text-xs text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
                  {result.warning}
                </p>
              ) : null}
              <a
                href="/admin/crm/broadcasts"
                className="inline-flex min-h-10 items-center justify-center rounded-sm border border-border px-4 py-2 text-xs font-bold text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Open campaign log
              </a>
            </div>
          ) : (
            <>
              <div className="rounded-sm border border-border bg-surface-muted/40 p-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  <ShieldCheck size={14} aria-hidden="true" />
                  Who receives this
                </div>
                {loadingAudience ? (
                  <p className="mt-3 flex items-center gap-2 text-sm font-bold text-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Counting confirmed subscribers…
                  </p>
                ) : (
                  <p className="mt-3 text-2xl font-black tracking-[-0.03em] text-foreground">
                    {count.toLocaleString()}{' '}
                    <span className="text-sm font-bold tracking-normal text-muted-foreground">
                      confirmed subscriber{count === 1 ? '' : 's'}
                    </span>
                  </p>
                )}
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Only CRM contacts with explicit chapter email consent <em>and</em> a completed
                  newsletter confirmation are included. Unconfirmed requests and anyone who
                  unsubscribed are excluded automatically.
                </p>
                {audience && audience.excludedCount > 0 ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    {audience.excludedCount.toLocaleString()} confirmed{' '}
                    {audience.excludedCount === 1 ? 'subscriber has' : 'subscribers have'} since
                    opted out and will not receive it.
                  </p>
                ) : null}
              </div>

              {scheduled ? (
                <div className="flex items-start gap-2.5 border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>
                    This issue is scheduled for a future date. Wait until it is published before
                    emailing it to the list.
                  </span>
                </div>
              ) : null}

              <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                <li className="flex gap-2">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                  Every message gets the branded broadcast shell, a link to the public issue, and a
                  one-click unsubscribe footer with a <code>List-Unsubscribe</code> header.
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                  To see the exact email first, use <strong>Send test</strong> in the bulletin
                  editor. It goes only to your signed-in admin address.
                </li>
              </ul>

              {step === 'confirm' ? (
                <div className="border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-100">
                  <p className="flex items-center gap-2 text-sm font-black">
                    <AlertTriangle size={16} aria-hidden="true" />
                    Send to {count.toLocaleString()} people now?
                  </p>
                  <p className="mt-2 text-xs leading-relaxed">
                    This hands the campaign to Resend and cannot be undone from this screen. Check
                    the test email and the public issue before confirming.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-surface-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-[11px] text-muted-foreground">
            {step === 'sent'
              ? 'Delivery progress is tracked in the campaign log.'
              : 'Test sends never reach the list.'}
          </p>
          <div className="flex items-center justify-end gap-2">
            {step === 'sent' ? (
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="min-h-10 rounded-sm bg-primary px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Done
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => (step === 'confirm' ? setStep('review') : onOpenChange(false))}
                  disabled={sending}
                  className="min-h-10 rounded-sm border border-border px-4 py-2 text-xs font-bold text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                >
                  {step === 'confirm' ? 'Back' : 'Cancel'}
                </button>
                {step === 'review' ? (
                  <button
                    type="button"
                    onClick={() => setStep('confirm')}
                    disabled={!canSend}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send size={13} aria-hidden="true" />
                    Send to subscribers
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={!canSend}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-sm bg-rose-700 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? (
                      <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Send size={13} aria-hidden="true" />
                    )}
                    {sending ? 'Sending…' : 'Confirm & send'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
