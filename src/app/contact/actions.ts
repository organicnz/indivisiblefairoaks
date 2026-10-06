'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { isE2EMode } from '@/lib/e2e-mode';
import { env } from '@/lib/env';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { containsSpamKeyword } from '@/lib/sanitize';
import { createServerClient } from '@/lib/supabase-server';

export type EmailStatus = 'sent' | 'failed' | 'not-requested';

export type ContactResult =
  | { error: string }
  | {
      success: true;
      /** Admin notification outcome. */
      emailStatus: EmailStatus;
      /** Sender-copy outcome; meaningful only when the box was ticked. */
      copyStatus: EmailStatus;
    };

/**
 * Where the notification goes.
 *
 * In an e2e build the override is mandatory and the live function is
 * unreachable by construction. `scripts/mock-notify-contact.mjs` exists so the
 * suite can drive the delivery-status UI — including the 502 and
 * "copied: false" branches — without a real send; the admin notification goes
 * to the chapter's real inbox, which is not a place to put test traffic.
 *
 * Returning '' rather than falling back to the production URL is deliberate. A
 * default that silently reappears if someone edits `playwright.config.ts` is a
 * mail-sending accident waiting for a maintenance window; `invokeNotify` turns
 * '' into a visible failure instead.
 */
function notifyUrl(): string {
  if (isE2EMode()) return env.CONTACT_FUNCTION_URL ?? '';
  return env.CONTACT_FUNCTION_URL ?? `${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-contact`;
}

async function invokeNotify(id: number): Promise<{ emailed: boolean; copied: boolean }> {
  const url = notifyUrl();
  if (!url) {
    console.error('notify-contact is unreachable: no CONTACT_FUNCTION_URL in an e2e build');
    return { emailed: false, copied: false };
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error('notify-contact rejected:', res.status, await res.text().catch(() => ''));
      return { emailed: false, copied: false };
    }
    const data = (await res.json()) as { emailed?: boolean; copied?: boolean };
    // A skipped claim (replayed id, volume cap) reports no send — surface as
    // failed so the UI never overstates delivery.
    if (data.emailed !== true)
      console.error(`notify-contact skipped for #${id}:`, JSON.stringify(data));
    return { emailed: data.emailed === true, copied: data.copied === true };
  } catch (err) {
    console.error(`notify-contact invocation failed for #${id}:`, err);
    return { emailed: false, copied: false };
  }
}

export async function submitContact(formData: FormData): Promise<ContactResult> {
  // 1. Honeypot check (bots often fill all fields)
  const honeypot = formData.get('website') as string;
  if (honeypot) {
    // Silently reject by pretending it worked — but leave an ops trail so a
    // real user whose password manager autofilled this field can be diagnosed
    // from Vercel logs against their report of "sent but nothing happened".
    const hint = String(formData.get('email') ?? '');
    // Hashed: enough to correlate a user report with logs, no raw PII.
    const hintHash = [...hint]
      .reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)
      .toString(16)
      .slice(0, 8);
    console.warn(`[contact] honeypot hit (email hash ${hintHash || 'none'})`);
    return { success: true, emailStatus: 'sent', copyStatus: 'not-requested' };
  }

  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const message = formData.get('message') as string;
  const wantsCopy = formData.get('sendCopy') === 'on';
  // Read with the same `'on'` convention as every other checkbox. Absence is the
  // answer: the submitter was shown the consent box and did not tick it, which is
  // a decline rather than an unknown.
  const consentToEmail = formData.get('consentToEmail') === 'on';

  // 2. Basic validation
  if (!name || !email || !message) {
    return { error: 'All fields are required.' };
  }

  // Control characters have no business in identity fields (header-injection
  // defense); messages may contain newlines and are JSON-transported anyway.
  const controlChars = /\p{C}/u;
  if (controlChars.test(name)) return { error: 'Name contains invalid characters.' };
  if (controlChars.test(email)) return { error: 'Email contains invalid characters.' };

  if (name.length < 2) return { error: 'Name is too short.' };
  if (message.length < 10) return { error: 'Message is too short.' };
  if (!email.includes('@')) return { error: 'Invalid email address.' };

  // Upper bounds keep payloads sane for PostgREST and Resend alike.
  if (name.length > 100) return { error: 'Name is too long.' };
  if (email.length > 254) return { error: 'Email is too long.' };
  if (message.length > 5000) return { error: 'Message is too long (5000 characters max).' };

  // Keyword screen for drive-by link spam.
  // Word boundaries, not substrings: a resident writing about a sign-up bonus
  // or a parking slot is not a spammer, and being told they are is a real
  // barrier to contacting the chapter.
  if (containsSpamKeyword(message)) {
    return { error: 'Message flagged as potential spam. Please revise.' };
  }

  // 1 submission / 10 minutes / IP (on top of the honeypot + keyword filter).
  // Deliberately strict: serverless isolates don't share in-memory counters,
  // so a low per-instance limit is what actually throttles floods. Humans
  // essentially never send two contact messages within ten minutes.
  // The cap is env-tunable so test harnesses can raise it without code forks.
  const maxPerWindow = env.CONTACT_RATE_LIMIT_MAX ?? 1;
  const gate = rateLimit(clientKey(await headers(), 'contact'), maxPerWindow, 10 * 60_000);
  if (!gate.ok) {
    return { error: `Too many messages sent. Please try again in ${gate.retryAfterSec}s.` };
  }

  const { data: id, error } = isE2EMode()
    ? { data: 1, error: null }
    : await (async () => {
        const supabase = await createServerClient();

        return supabase.rpc('submit_contact_submission', {
          p_name: name,
          p_email: email,
          p_message: message,
          p_wants_copy: wantsCopy,
          /*
           * The consent answer, and it is separate from `wantsCopy` on purpose.
           *
           * `wantsCopy` is transactional — a copy of *this* message, which the
           * privacy copy on the form says so about. It was the only consent-ish
           * signal the form ever sent, and the CRM read `do_not_email`'s column
           * default instead, so every contact-form submitter landed in the next
           * broadcast audience.
           *
           * Both answers are recorded. `false` is not "unknown": the resident
           * was shown the box and declined, and the sync trigger writes
           * `do_not_email = true` for that. There is no path from here to an
           * explicit opt-in other than ticking it.
           */
          p_consent_to_email: consentToEmail,
        });
      })();

  if (error || typeof id !== 'number') {
    console.error('Contact submission error:', error?.message);
    return { error: 'Failed to send message. Please try again later.' };
  }

  // Await the notification so the UI can report real delivery status. The
  // function's atomic claim keeps this safe against retries and replays.
  //
  // This is the real notifier, not a stub, and that is safe: in an e2e build
  // `notifyUrl()` refuses to fall back to the live Edge Function, so the call
  // can only reach the local mock. Keeping the call means the suite still
  // exercises the honest-delivery-status UI, including its failure branches —
  // which a bypass would have silently made unreachable.
  const { emailed, copied } = await invokeNotify(id);

  revalidatePath('/contact');
  return {
    success: true,
    emailStatus: emailed ? 'sent' : 'failed',
    copyStatus: !wantsCopy ? 'not-requested' : copied ? 'sent' : 'failed',
  };
}
