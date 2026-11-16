'use client';

import { CheckCircle2, LoaderCircle, LockKeyhole, TriangleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { fetchWithTimeout } from '@/lib/service-fetch';
import { solveIceAlertProof } from './proof-of-work';
import { US_STATE_OPTIONS } from './us-state-options';

type SubmitResult = {
  ok: true;
  referenceCode: string;
  message: string;
};

type SubmitError = {
  ok: false;
  message: string;
};

const inputClass =
  'mt-1 min-h-11 w-full border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground focus-visible:ring-2 focus-visible:ring-primary/40';

const labelClass =
  'block font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground';

export function IceReportForm() {
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [kind, setKind] = useState('enforcement');
  const [observedAt, setObservedAt] = useState('');
  const [summary, setSummary] = useState('');
  const [consent, setConsent] = useState(false);
  const [company, setCompany] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      if (!consent) {
        setError('Confirm the review and publication terms before sending.');
        return;
      }

      const parsedTime = new Date(observedAt);
      if (!observedAt || Number.isNaN(parsedTime.getTime())) {
        setError('Choose the time you observed the activity.');
        return;
      }

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

      const proofNonce = await solveIceAlertProof(challenge.challenge, challenge.difficulty);

      const response = await fetchWithTimeout(
        '/api/ice-reports',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            city,
            stateCode,
            kind,
            observedAt: parsedTime.toISOString(),
            summary,
            consent,
            company,
            proof: { token: challenge.challenge, nonce: proofNonce },
          }),
        },
        30_000
      );
      const payload = (await response.json().catch(() => ({}))) as
        | SubmitResult
        | SubmitError;

      if (!response.ok || !payload || payload.ok !== true) {
        setError(
          payload && 'message' in payload && payload.message
            ? payload.message
            : 'The report could not be sent. Try again shortly.'
        );
        return;
      }

      setResult(payload);
      setCity('');
      setStateCode('');
      setKind('enforcement');
      setObservedAt('');
      setSummary('');
      setConsent(false);
    } catch (failure) {
      setError(
        failure instanceof Error && failure.message
          ? failure.message
          : 'The report could not be sent. Check your connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div role="status" aria-live="polite" className="border border-primary/30 bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="font-display text-2xl font-semibold leading-tight tracking-[-0.03em]">
              Report received privately.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{result.message}</p>
          </div>
        </div>

        <div className="mt-5 border border-border bg-background p-4">
          <p className="font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Private reference
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-[0.08em] text-foreground">
            {result.referenceCode}
          </p>
          <p className="mt-2 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
            <LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Save this reference. It does not create a public profile or a guaranteed response.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setResult(null)}
          className="mt-4 inline-flex min-h-11 items-center border border-border px-3 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Submit another report
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="ice-report-company">Leave this field empty</label>
        <input
          id="ice-report-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="font-display text-lg font-semibold tracking-[-0.02em]">
          Where and when
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ice-report-city" className={labelClass}>
              City <span className="text-accent">*</span>
            </label>
            <input
              id="ice-report-city"
              name="city"
              required
              maxLength={80}
              autoComplete="address-level2"
              placeholder="City only"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="ice-report-state" className={labelClass}>
              State <span className="text-accent">*</span>
            </label>
            <select
              id="ice-report-state"
              name="stateCode"
              required
              value={stateCode}
              onChange={(event) => setStateCode(event.target.value)}
              className={inputClass}
            >
              <option value="">Choose a state</option>
              {US_STATE_OPTIONS.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ice-report-kind" className={labelClass}>
              What did you see? <span className="text-accent">*</span>
            </label>
            <select
              id="ice-report-kind"
              name="kind"
              required
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              className={inputClass}
            >
              <option value="enforcement">Enforcement activity</option>
              <option value="detention">Detention activity</option>
              <option value="checkpoint">Checkpoint or roadblock</option>
            </select>
          </div>
          <div>
            <label htmlFor="ice-report-observed-at" className={labelClass}>
              Time observed <span className="text-accent">*</span>
            </label>
            <input
              id="ice-report-observed-at"
              name="observedAt"
              type="datetime-local"
              required
              value={observedAt}
              onChange={(event) => setObservedAt(event.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              Within the last 24 hours. Use your local time.
            </p>
          </div>
        </div>
      </fieldset>

      <div className="border-t border-border pt-5">
        <label htmlFor="ice-report-summary" className={labelClass}>
          What did you observe? <span className="text-accent">*</span>
        </label>
        <textarea
          id="ice-report-summary"
          name="summary"
          required
          minLength={30}
          maxLength={600}
          rows={5}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="Describe the activity, direction of travel, and what you could safely see. Do not include names, faces, plates, addresses, or contact details."
          className={`${inputClass} resize-y leading-relaxed`}
        />
        <div className="mt-1 flex flex-wrap items-start justify-between gap-2 text-[10px] leading-relaxed text-muted-foreground">
          <p className="max-w-xl">
            City-level only. Do not include a street address, plate, name, face, immigration
            status, or anyone&apos;s contact details.
          </p>
          <span className="font-mono font-bold">{summary.length}/600</span>
        </div>
      </div>

      <label className="flex items-start gap-3 border border-border bg-surface-muted p-3 text-xs leading-relaxed text-muted-foreground">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          required
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          I understand this is a private report for chapter review. If two different reviewers
          approve it, only a sanitized, city-level summary may be published. It will not appear
          automatically, and it does not guarantee a response.
        </span>
      </label>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 border border-accent/40 bg-accent/10 p-3 text-xs leading-relaxed text-foreground"
        >
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-11 items-center justify-center gap-2 border border-primary bg-primary px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {submitting ? 'Checking and sending…' : 'Send private report'}
        </button>
        <p className="mt-2 max-w-xl text-[10px] leading-relaxed text-muted-foreground">
          This form does not ask for your name or contact details. Do not include them in the
          report. Immediate danger? Call 911. Do not approach or obstruct enforcement.
        </p>
      </div>
    </form>
  );
}
