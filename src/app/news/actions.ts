'use server';

import { headers } from 'next/headers';
import { isE2EMode } from '@/lib/e2e-mode';
import {
  createNewsletterConfirmation,
  sendNewsletterConfirmation,
  withNewsletterRequestTags,
} from '@/lib/newsletter-subscription';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase-server';
import type {
  CRMContactInsert,
  CRMContactUpdate,
  NewsletterContact,
  NewsletterContactInsert,
  NewsletterContactUpdate,
} from '@/types/crm';

type ExistingContact = Pick<
  NewsletterContact,
  | 'id'
  | 'email'
  | 'first_name'
  | 'tags'
  | 'do_not_email'
  | 'unsubscribed_at'
  | 'newsletter_confirmed_at'
  | 'newsletter_confirm_token'
  | 'newsletter_confirm_expires_at'
>;

export type SubscribeResult =
  | { error: string }
  | {
      success: true;
      message: string;
      alreadySubscribed?: boolean;
      pendingConfirmation?: boolean;
    };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

const PENDING_MESSAGE = 'Check your inbox and click the confirmation link to finish subscribing.';
const ALREADY_MESSAGE = 'This address is already subscribed to Action Alerts.';
const SEND_FAILED_MESSAGE =
  'We could not send the confirmation email right now. Please try again, or email contact@indivisiblefairoaks.org.';

export async function subscribeActionAlerts(formData: FormData): Promise<SubscribeResult> {
  // 1. Anti-bot honeypot check
  const honeypot = formData.get('website');
  if (honeypot && String(honeypot).trim().length > 0) {
    console.warn('[subscribeActionAlerts] honeypot triggered by bot');
    return {
      success: true,
      message: PENDING_MESSAGE,
      pendingConfirmation: true,
    };
  }

  // 2. Extract and sanitize inputs
  const rawEmail = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const rawName = String(formData.get('name') ?? '').trim();

  if (!rawEmail) {
    return { error: 'Please enter your email address.' };
  }

  if (CONTROL_CHARS.test(rawEmail) || rawEmail.length > 254 || !EMAIL_REGEX.test(rawEmail)) {
    return { error: 'Please enter a valid email address.' };
  }

  if (rawName && (CONTROL_CHARS.test(rawName) || rawName.length > 100)) {
    return { error: 'Please enter a valid name (under 100 characters).' };
  }

  // 3. Rate limiting (5 requests per 10 minutes per IP)
  const gate = rateLimit(clientKey(await headers(), 'subscribe-action-alerts'), 5, 10 * 60_000);
  if (!gate.ok) {
    return {
      error: `Too many subscription attempts. Please try again in ${gate.retryAfterSec}s.`,
    };
  }

  // 4. In E2E test mode, short-circuit gracefully
  if (isE2EMode()) {
    return {
      success: true,
      message: PENDING_MESSAGE,
      pendingConfirmation: true,
    };
  }

  try {
    const adminClient = await createAdminClient();

    // Check if contact already exists
    const { data: existingRow, error: selectError } = await adminClient
      .from('crm_contacts')
      .select(
        'id, email, first_name, tags, do_not_email, unsubscribed_at, newsletter_confirmed_at, newsletter_confirm_token, newsletter_confirm_expires_at'
      )
      .eq('email', rawEmail)
      .maybeSingle();

    if (selectError) {
      console.error('[subscribeActionAlerts] lookup failed:', selectError);
      return {
        error:
          'Unable to process your subscription right now. Please try again or email us directly.',
      };
    }

    // The generated row type does not know the unapplied migration's columns;
    // the selected subset is exactly `ExistingContact`.
    const existing = existingRow as unknown as ExistingContact | null;

    const now = new Date().toISOString();

    if (existing) {
      /*
       * A public form submission is intent, not proof that the owner of the
       * address typed it. The confirmation email is the proof. An existing
       * opt-out is therefore left exactly as it is until that link is followed;
       * this request can only create a pending token, never clear consent. A
       * contact who has already completed the gate is already subscribed and
       * does not need another message.
       */
      if (
        existing.do_not_email === false &&
        !existing.unsubscribed_at &&
        existing.newsletter_confirmed_at
      ) {
        return {
          success: true,
          message: ALREADY_MESSAGE,
          alreadySubscribed: true,
        };
      }

      const confirmation = createNewsletterConfirmation();

      const updatePayload: NewsletterContactUpdate = {
        tags: withNewsletterRequestTags(Array.isArray(existing.tags) ? existing.tags : []),
        newsletter_confirm_token: confirmation.token,
        newsletter_confirm_expires_at: confirmation.expiresAt,
        newsletter_confirmation_sent_at: confirmation.confirmationSentAt,
        updated_at: now,
      };

      if (!existing.first_name && rawName) {
        updatePayload.first_name = rawName;
      }

      const { error: updateError } = await adminClient
        .from('crm_contacts')
        // The generated write type rejects the migration-only columns; the
        // payload is the same object at runtime.
        .update(updatePayload as unknown as CRMContactUpdate)
        .eq('id', existing.id);

      if (updateError) {
        console.error('[subscribeActionAlerts] update failed:', updateError);
        return {
          error: 'Failed to save the subscription request. Please email us directly.',
        };
      }

      const sent = await sendNewsletterConfirmation({
        email: rawEmail,
        firstName: existing.first_name || rawName || null,
        token: confirmation.token,
      });
      if (!sent.ok) {
        console.error('[subscribeActionAlerts] confirmation email failed:', sent.error);
        return { error: SEND_FAILED_MESSAGE };
      }

      await adminClient.from('crm_activities').insert({
        contact_id: existing.id,
        type: 'note',
        title: 'Newsletter confirmation sent',
        description: 'Action Alerts confirmation email sent from the website.',
        metadata: {
          channel: 'news_page_subscription',
          source: 'action_alerts',
          requested_at: now,
          expires_at: confirmation.expiresAt,
        },
      });

      return {
        success: true,
        message: PENDING_MESSAGE,
        pendingConfirmation: true,
      };
    }

    // New contact. `do_not_email: null` is "never asked": the row is not in any
    // broadcast audience until the confirmation link is followed.
    const confirmation = createNewsletterConfirmation();
    const insertPayload: NewsletterContactInsert = {
      email: rawEmail,
      first_name: rawName || null,
      status: 'supporter',
      source: 'manual',
      tags: withNewsletterRequestTags([]),
      do_not_email: null,
      newsletter_confirm_token: confirmation.token,
      newsletter_confirm_expires_at: confirmation.expiresAt,
      newsletter_confirmation_sent_at: confirmation.confirmationSentAt,
      notes: 'Requested Action Alerts newsletter confirmation via website',
      created_at: now,
      updated_at: now,
    };
    const { data: inserted, error: insertError } = await adminClient
      .from('crm_contacts')
      .insert(insertPayload as unknown as CRMContactInsert)
      .select('id')
      .single();

    if (insertError) {
      console.error('[subscribeActionAlerts] insertion failed:', insertError);
      return {
        error: 'Failed to save the subscription request. Please email us directly.',
      };
    }

    const sent = await sendNewsletterConfirmation({
      email: rawEmail,
      firstName: rawName || null,
      token: confirmation.token,
    });
    if (!sent.ok) {
      console.error('[subscribeActionAlerts] confirmation email failed:', sent.error);
      return { error: SEND_FAILED_MESSAGE };
    }

    if (inserted) {
      await adminClient.from('crm_activities').insert({
        contact_id: inserted.id,
        type: 'note',
        title: 'Newsletter confirmation sent',
        description: 'New contact requested Action Alerts from the website.',
        metadata: {
          channel: 'news_page_subscription',
          source: 'action_alerts',
          requested_at: now,
          expires_at: confirmation.expiresAt,
        },
      });
    }

    return {
      success: true,
      message: PENDING_MESSAGE,
      pendingConfirmation: true,
    };
  } catch (err) {
    console.error('[subscribeActionAlerts] unexpected error:', err);
    return {
      error: 'An unexpected error occurred. Please try again later or use the email link.',
    };
  }
}
