'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { isE2EMode } from '@/lib/e2e-mode';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase-server';
import type { Database } from '@/types/supabase';

type ContactUpdate = Database['public']['Tables']['crm_contacts']['Update'];

export type SubscribeResult =
  | { error: string }
  | { success: true; message: string; alreadySubscribed?: boolean };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

export async function subscribeActionAlerts(formData: FormData): Promise<SubscribeResult> {
  // 1. Anti-bot honeypot check
  const honeypot = formData.get('website');
  if (honeypot && String(honeypot).trim().length > 0) {
    console.warn('[subscribeActionAlerts] honeypot triggered by bot');
    return {
      success: true,
      message: "You're on the list! Thank you for standing with Indivisible Fair Oaks-Carmichael.",
    };
  }

  // 2. Extract and sanitize inputs
  const rawEmail = String(formData.get('email') ?? '').trim().toLowerCase();
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
      message: "You're on the list! Thank you for standing with Indivisible Fair Oaks-Carmichael.",
      alreadySubscribed: false,
    };
  }

  try {
    const adminClient = await createAdminClient();

    // Check if contact already exists
    const { data: existing, error: selectError } = await adminClient
      .from('crm_contacts')
      .select('id, email, first_name, tags, do_not_email')
      .eq('email', rawEmail)
      .maybeSingle();

    if (selectError) {
      console.error('[subscribeActionAlerts] lookup failed:', selectError);
      return {
        error: 'Unable to process your subscription right now. Please try again or email us directly.',
      };
    }

    const now = new Date().toISOString();
    const requiredTags = ['action-alerts', 'newsletter'];

    if (existing) {
      const existingTags = Array.isArray(existing.tags) ? existing.tags : [];
      const mergedTags = Array.from(new Set([...existingTags, ...requiredTags]));
      const wasOptedOut = existing.do_not_email === true;

      const updatePayload: ContactUpdate = {
        do_not_email: false,
        unsubscribed_at: null,
        tags: mergedTags,
        updated_at: now,
      };

      if (!existing.first_name && rawName) {
        updatePayload.first_name = rawName;
      }

      const { error: updateError } = await adminClient
        .from('crm_contacts')
        .update(updatePayload)
        .eq('id', existing.id);

      if (updateError) {
        console.error('[subscribeActionAlerts] update failed:', updateError);
        return {
          error: 'Failed to update subscription. Please email us directly.',
        };
      }

      // Log note activity in crm_activities
      await adminClient.from('crm_activities').insert({
        contact_id: existing.id,
        type: 'note',
        title: 'Subscribed to Action Alerts',
        description: wasOptedOut
          ? 'Contact re-subscribed to Action Alerts and cleared opt-out.'
          : 'Contact renewed/confirmed Action Alerts subscription.',
        metadata: {
          channel: 'news_page_subscription',
          source: 'action_alerts',
          subscribed_at: now,
        },
      });

      revalidatePath('/news');
      return {
        success: true,
        message: "You're on the list! Thank you for standing with Indivisible Fair Oaks-Carmichael.",
        alreadySubscribed: !wasOptedOut,
      };
    }

    // New subscriber insertion
    const { data: inserted, error: insertError } = await adminClient
      .from('crm_contacts')
      .insert({
        email: rawEmail,
        first_name: rawName || null,
        status: 'supporter',
        source: 'manual',
        tags: requiredTags,
        do_not_email: false,
        notes: 'Subscribed to Action Alerts via website newsletter card',
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[subscribeActionAlerts] insertion failed:', insertError);
      return {
        error: 'Failed to save subscription. Please email us directly.',
      };
    }

    if (inserted) {
      await adminClient.from('crm_activities').insert({
        contact_id: inserted.id,
        type: 'note',
        title: 'Subscribed to Action Alerts',
        description: 'New contact subscribed to Action Alerts from the website.',
        metadata: {
          channel: 'news_page_subscription',
          source: 'action_alerts',
          subscribed_at: now,
        },
      });
    }

    revalidatePath('/news');
    return {
      success: true,
      message: "You're on the list! Thank you for standing with Indivisible Fair Oaks-Carmichael.",
      alreadySubscribed: false,
    };
  } catch (err) {
    console.error('[subscribeActionAlerts] unexpected error:', err);
    return {
      error: 'An unexpected error occurred. Please try again later or use the email link.',
    };
  }
}
