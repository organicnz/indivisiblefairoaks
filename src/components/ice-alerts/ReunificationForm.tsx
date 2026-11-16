'use client';

import { CheckCircle2, FileImage, LockKeyhole, LoaderCircle, TriangleAlert } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
import { fetchWithTimeout } from '@/lib/service-fetch';

type SubmitResult = {
  ok: true;
  referenceCode: string;
  statusUrl: string;
  emailDelivered: boolean;
  message: string;
  status?: string;
};

type SubmitError = {
  ok: false;
  message: string;
};

const PHOTO_MAX_BYTES = 4 * 1024 * 1024;

const inputClass =
  'mt-1 w-full border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground focus-visible:ring-2 focus-visible:ring-primary/40';

const labelClass =
  'block font-mono text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground';

export function ReunificationForm() {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function onPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    setPhotoError(null);
    const file = event.currentTarget.files?.[0];
    if (!file) {
      setPhotoPreview(null);
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setPhotoError('Use a photo under 4 MB.');
      event.currentTarget.value = '';
      setPhotoPreview(null);
      return;
    }
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetchWithTimeout(
        '/api/ice-reunification',
        {
          method: 'POST',
          body: new FormData(form),
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
            : 'The request could not be sent. Try again shortly.'
        );
        return;
      }

      setResult(payload);
      form.reset();
      setPhotoPreview(null);
    } catch {
      setError('The request could not be sent. Check your connection and try again.');
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
              Your request is saved.
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
          <a
            href={result.statusUrl}
            className="mt-3 inline-flex min-h-9 items-center gap-1.5 border border-border bg-foreground px-3 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-background transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <LockKeyhole className="size-3" aria-hidden="true" />
            Open private status
          </a>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Save this reference and link. Do not forward the link; it is the private key to your
            status.
          </p>
        </div>

        {!result.emailDelivered ? (
          <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-accent">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            The confirmation email could not be sent. The request is saved, but save the reference
            and status link above now.
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setResult(null)}
          className="mt-4 inline-flex min-h-9 items-center border border-border px-3 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Start another request
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <fieldset className="space-y-3">
        <legend className="font-display text-lg font-semibold tracking-[-0.02em]">
          Your contact information
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="submitter_name" className={labelClass}>
              Your name <span className="text-accent">*</span>
            </label>
            <input
              id="submitter_name"
              name="submitter_name"
              required
              maxLength={120}
              autoComplete="name"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="submitter_email" className={labelClass}>
              Email <span className="text-accent">*</span>
            </label>
            <input
              id="submitter_email"
              name="submitter_email"
              type="email"
              required
              maxLength={320}
              autoComplete="email"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="submitter_phone" className={labelClass}>
              Phone <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <input
              id="submitter_phone"
              name="submitter_phone"
              type="tel"
              maxLength={40}
              autoComplete="tel"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="relationship" className={labelClass}>
              Your relationship <span className="text-accent">*</span>
            </label>
            <input
              id="relationship"
              name="relationship"
              required
              maxLength={80}
              placeholder="Parent, sibling, friend, attorney..."
              className={inputClass}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3 border-t border-border pt-5">
        <legend className="font-display text-lg font-semibold tracking-[-0.02em]">
          The person in custody
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="person_name" className={labelClass}>
              Full name used in custody <span className="text-accent">*</span>
            </label>
            <input
              id="person_name"
              name="person_name"
              required
              maxLength={120}
              autoComplete="off"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="person_aliases" className={labelClass}>
              Other names <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <input
              id="person_aliases"
              name="person_aliases"
              maxLength={200}
              autoComplete="off"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="person_dob" className={labelClass}>
              Date of birth <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <input id="person_dob" name="person_dob" type="date" className={inputClass} />
          </div>
          <div>
            <label htmlFor="detention_date" className={labelClass}>
              Date taken <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <input id="detention_date" name="detention_date" type="date" className={inputClass} />
          </div>
          <div>
            <label htmlFor="a_number" className={labelClass}>
              A-Number <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <input
              id="a_number"
              name="a_number"
              maxLength={24}
              placeholder="A123456789"
              autoComplete="off"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="detention_city" className={labelClass}>
              Detention city <span className="normal-case tracking-normal">(if known)</span>
            </label>
            <input
              id="detention_city"
              name="detention_city"
              maxLength={80}
              autoComplete="address-level2"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="detention_state" className={labelClass}>
              State <span className="normal-case tracking-normal">(if known)</span>
            </label>
            <input
              id="detention_state"
              name="detention_state"
              maxLength={2}
              placeholder="CA"
              autoComplete="address-level1"
              className={`${inputClass} uppercase`}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="facility" className={labelClass}>
              Facility or office <span className="normal-case tracking-normal">(if known)</span>
            </label>
            <input
              id="facility"
              name="facility"
              maxLength={160}
              autoComplete="off"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="notes" className={labelClass}>
              What else should a volunteer know?{' '}
              <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              maxLength={4000}
              placeholder="Language, urgent medical needs, court date, or a safe way to reach you. Do not include immigration status or guesses."
              className={`${inputClass} resize-y`}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3 border-t border-border pt-5">
        <legend className="font-display text-lg font-semibold tracking-[-0.02em]">
          Optional private photo
        </legend>
        <p className="text-xs leading-relaxed text-muted-foreground">
          A recent photo can help verification. It is stored privately and never appears on the
          map. JPEG, PNG, or WebP, under 4 MB.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor="photo"
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 border border-border bg-background px-3 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-foreground focus-within:ring-2 focus-within:ring-primary"
          >
            <FileImage className="size-3.5" aria-hidden="true" />
            Choose photo
            <input
              id="photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onPhotoChange}
              className="sr-only"
            />
          </label>
          {photoPreview ? (
            // The preview is a local object URL; it never leaves the browser before submit.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoPreview}
              alt="Selected photo preview"
              className="size-14 border border-border object-cover"
            />
          ) : null}
        </div>
        {photoError ? (
          <p className="text-xs font-semibold text-accent" role="alert">
            {photoError}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="space-y-2 border-t border-border pt-5">
        <legend className="font-display text-lg font-semibold tracking-[-0.02em]">
          Consent
        </legend>
        <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            name="consent_contact"
            required
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span>
            I consent to a volunteer contacting me at the email or phone number above about this
            request.
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            name="consent_privacy"
            required
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span>
            I understand this is a private request, not a public alert, and that names, photos, and
            case details will not be published on the map.
          </span>
        </label>
      </fieldset>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 border border-accent/40 bg-accent/10 p-3 text-xs leading-relaxed text-accent"
        >
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-10 items-center gap-2 bg-foreground px-4 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-background transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
        >
          {submitting ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <LockKeyhole className="size-3.5" aria-hidden="true" />
          )}
          {submitting ? 'Sending privately...' : 'Send private request'}
        </button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Do not use this form for immediate danger. Call 911.
        </p>
      </div>
    </form>
  );
}
