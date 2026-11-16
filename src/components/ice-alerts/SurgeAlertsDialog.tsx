'use client';

import { Bell, BellRing, Check, LoaderCircle, Smartphone } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { fetchWithTimeout } from '@/lib/service-fetch';
import { solveIceAlertProof } from './proof-of-work';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog';
import {
  currentPushSubscription,
  disablePushAlerts,
  enablePushAlerts,
  isPushSupported,
  pushPublicKey,
  type BrowserPushSubscription,
} from './push-alerts';
import { US_STATE_OPTIONS } from './us-state-options';

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

type PushState =
  | 'unsupported'
  | 'unconfigured'
  | 'off'
  | 'enabling'
  | 'on'
  | 'error';

export function SurgeAlertsButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [city, setCity] = useState('');
  const [company, setCompany] = useState('');
  const [pushSubscription, setPushSubscription] =
    useState<BrowserPushSubscription | null>(null);
  const [pushState, setPushState] = useState<PushState>('off');
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ status: 'idle' });
  const emailId = useId();
  const stateId = useId();
  const cityId = useId();
  const statusId = useId();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    if (!isPushSupported()) {
      setPushState('unsupported');
      return;
    }
    if (!pushPublicKey()) {
      setPushState('unconfigured');
      return;
    }

    void currentPushSubscription()
      .then((subscription) => {
        if (cancelled) return;
        setPushSubscription(subscription);
        setPushState(subscription ? 'on' : 'off');
      })
      .catch(() => {
        if (!cancelled) setPushState('off');
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && submit.status === 'success') {
      setSubmit({ status: 'idle' });
    }
  };

  const handlePush = async () => {
    setPushMessage(null);
    if (pushState === 'on') {
      setPushState('enabling');
      try {
        await disablePushAlerts();
        setPushSubscription(null);
        setPushState('off');
      } catch {
        setPushState('on');
        setPushMessage('Could not turn off phone alerts in this browser.');
      }
      return;
    }

    setPushState('enabling');
    try {
      const subscription = await enablePushAlerts();
      setPushSubscription(subscription);
      setPushState('on');
    } catch (error) {
      setPushState('error');
      setPushMessage(
        error instanceof Error
          ? error.message
          : 'Could not enable phone alerts in this browser.'
      );
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmit({ status: 'submitting' });

    try {
      const challengeResponse = await fetchWithTimeout('/api/ice-rapid/challenge', {
        cache: 'no-store',
      });
      const challenge = (await challengeResponse.json().catch(() => ({}))) as {
        ok?: boolean;
        challenge?: string;
        difficulty?: number;
        message?: string;
      };
      if (
        !challengeResponse.ok ||
        !challenge.ok ||
        typeof challenge.challenge !== 'string' ||
        typeof challenge.difficulty !== 'number'
      ) {
        throw new Error(
          challenge.message || 'Could not complete the browser check. Try again.'
        );
      }

      const proofNonce = await solveIceAlertProof(
        challenge.challenge,
        challenge.difficulty
      );

      const response = await fetchWithTimeout('/api/ice-rapid/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          stateCode: stateCode || undefined,
          city: city.trim() || undefined,
          pushSubscription: pushSubscription ?? undefined,
          proof: { token: challenge.challenge, nonce: proofNonce },
          company,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        status?: string;
      };
      if (!response.ok || !payload.ok) {
        setSubmit({
          status: 'error',
          message:
            payload.message ||
            'Could not save the subscription. Check the email and try again.',
        });
        return;
      }

      setSubmit({
        status: 'success',
        message:
          payload.message ||
          'Check your inbox to confirm. Then surge alerts are active.',
      });
    } catch (error) {
      setSubmit({
        status: 'error',
        message:
          error instanceof Error &&
          (error.message.includes('browser check') ||
            error.message.includes('cannot complete'))
            ? error.message
            : 'The subscription service is unreachable. Try again shortly.',
      });
    }
  };

  const pushDisabled =
    pushState === 'unsupported' ||
    pushState === 'unconfigured' ||
    pushState === 'enabling';
  const pushLabel =
    pushState === 'on'
      ? 'Phone alerts on'
      : pushState === 'enabling'
        ? 'Checking phone…'
        : 'Add phone alerts';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="signal" size="sm">
          <Bell className="size-3.5" aria-hidden="true" />
          Surge alerts
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto p-6 sm:p-7">
        <DialogHeader>
          <span className="civic-section-index">Rapid-response alerts</span>
          <DialogTitle className="mt-1">Get surge alerts</DialogTitle>
          <DialogDescription>
            A short email or phone notification when community reports cluster in your area.
            City-level only. Unsubscribe anytime.
          </DialogDescription>
        </DialogHeader>

        {submit.status === 'success' ? (
          <div
            role="status"
            className="border border-primary/40 bg-primary/10 p-4 text-sm leading-relaxed text-foreground"
          >
            <p className="flex items-center gap-2 font-semibold">
              <Check className="size-4 text-primary" aria-hidden="true" />
              Request received
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{submit.message}</p>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Alerts are based on a public community export that updates nightly, not a live
              dispatch feed. Immediate danger? Call 911.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-2 space-y-4">
            <div>
              <label
                htmlFor={emailId}
                className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground"
              >
                Email
              </label>
              <input
                id={emailId}
                type="email"
                required
                maxLength={320}
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-1 min-h-11 w-full border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor={stateId}
                  className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground"
                >
                  State
                </label>
                <select
                  id={stateId}
                  value={stateCode}
                  onChange={(event) => setStateCode(event.target.value)}
                  className="mt-1 min-h-11 w-full border border-border bg-background px-2.5 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <option value="">Nationwide</option>
                  {US_STATE_OPTIONS.map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor={cityId}
                  className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground"
                >
                  City <span className="normal-case tracking-normal">(optional)</span>
                </label>
                <input
                  id={cityId}
                  type="text"
                  maxLength={80}
                  autoComplete="address-level2"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Santa Ana"
                  className="mt-1 min-h-11 w-full border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                />
              </div>
            </div>

            <div className="border border-border bg-surface-muted p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <Smartphone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Phone or browser</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                      {pushState === 'on'
                        ? 'This browser is armed. Alerts arrive after email confirmation.'
                        : pushState === 'unsupported'
                          ? 'Push is not supported here. Email alerts still work.'
                          : pushState === 'unconfigured'
                            ? 'Phone alerts are not configured on this deployment.'
                            : 'Add a push notification after confirming email.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handlePush}
                  disabled={pushDisabled}
                  aria-pressed={pushState === 'on'}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 border border-border bg-background px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pushState === 'enabling' ? (
                    <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
                  ) : pushState === 'on' ? (
                    <BellRing className="size-3" aria-hidden="true" />
                  ) : (
                    <Bell className="size-3" aria-hidden="true" />
                  )}
                  {pushLabel}
                </button>
              </div>
              {pushMessage ? (
                <p role="status" className="mt-2 text-[10px] leading-relaxed text-accent">
                  {pushMessage}
                </p>
              ) : null}
            </div>

            <div className="hidden" aria-hidden="true">
              <label htmlFor="ice-surge-company">Company</label>
              <input
                id="ice-surge-company"
                name="company"
                tabIndex={-1}
                autoComplete="off"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              />
            </div>

            <div>
              <Button
                type="submit"
                disabled={submit.status === 'submitting'}
                className="w-full"
              >
                {submit.status === 'submitting' ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Bell className="size-4" aria-hidden="true" />
                )}
                {submit.status === 'submitting' ? 'Saving…' : 'Start surge alerts'}
              </Button>
              <p
                id={statusId}
                role="status"
                aria-live="polite"
                className={`mt-2 text-[10px] leading-relaxed ${
                  submit.status === 'error' ? 'text-accent' : 'text-muted-foreground'
                }`}
              >
                {submit.status === 'error'
                  ? submit.message
                  : 'We send only when reports cluster. No street addresses, names, or faces.'}
              </p>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
