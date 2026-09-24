'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { env } from '@/lib/env';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { SPAM_KEYWORDS } from '@/lib/sanitize';
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

/** Direct URL override for tests; defaults to the project's notify-contact. */
function notifyUrl(): string {
  return env.CONTACT_FUNCTION_URL ?? `${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-contact`;
}

async function invokeNotify(id: number): Promise<{ emailed: boolean; copied: boolean }> {
  try {
    const res = await fetch(notifyUrl(), {
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
  if (SPAM_KEYWORDS.some((kw) => message.toLowerCase().includes(kw))) {
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

  const { data: id, error } =
    env.CONTACT_SUBMISSION_TEST_MODE === '1' && env.NEXT_E2E_BUILD === 'true'
      ? { data: 1, error: null }
      : await (async () => {
          const supabase = await createServerClient();

          return supabase.rpc('submit_contact_submission', {
            p_name: name,
            p_email: email,
            p_message: message,
            p_wants_copy: wantsCopy,
          });
        })();

  if (error || typeof id !== 'number') {
    console.error('Contact submission error:', error?.message);
    return { error: 'Failed to send message. Please try again later.' };
  }

  // Await the notification so the UI can report real delivery status. The
  // function's atomic claim keeps this safe against retries and replays.
  const { emailed, copied } = await invokeNotify(id);

  revalidatePath('/contact');
  return {
    success: true,
    emailStatus: emailed ? 'sent' : 'failed',
    copyStatus: !wantsCopy ? 'not-requested' : copied ? 'sent' : 'failed',
  };
}
