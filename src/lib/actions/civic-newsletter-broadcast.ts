'use server';

import {
  getBroadcastRecipientCount,
  sendCRMBroadcast,
  sendCRMBroadcastSelfTest,
} from '@/lib/actions/crm/broadcasts';
import { sendBlockedInE2E } from '@/lib/actions/crm/shared';
import { requireAdmin } from '@/lib/admin-auth';
import { buildBulletinBroadcast } from '@/lib/newsletter-subscription';
import {
  NEWSLETTER_LIMITS,
  newsletterPublicationState,
  slugifyNewsletter,
} from '@/lib/newsletters';

export type NewsletterBroadcastResult = {
  success: boolean;
  error?: string;
  warning?: string;
  recipientCount?: number;
  broadcastId?: string;
  testRecipient?: string;
};

export type NewsletterBroadcastDraft = {
  title: string;
  dateLabel: string;
  description: string;
  body?: string | null;
  pdfUrl?: string | null;
  archiveUrl?: string | null;
  slug?: string | null;
};

function validateDraft(draft: NewsletterBroadcastDraft): string | null {
  const title = draft.title.trim();
  const dateLabel = draft.dateLabel.trim();
  const description = draft.description.trim();

  if (!title) return 'Give the bulletin a title before sending.';
  if (title.length > NEWSLETTER_LIMITS.title) {
    return `Titles are limited to ${NEWSLETTER_LIMITS.title} characters.`;
  }
  if (!dateLabel) return 'Add the issue or date label before sending.';
  if (dateLabel.length > NEWSLETTER_LIMITS.dateLabel) {
    return `Issue labels are limited to ${NEWSLETTER_LIMITS.dateLabel} characters.`;
  }
  if (!description) return 'Add a short summary before sending.';
  if (description.length > NEWSLETTER_LIMITS.description) {
    return `Summaries are limited to ${NEWSLETTER_LIMITS.description} characters.`;
  }
  if ((draft.body?.length ?? 0) > NEWSLETTER_LIMITS.body) {
    return `The full issue is limited to ${NEWSLETTER_LIMITS.body} characters.`;
  }
  return null;
}

/**
 * Send the current editor draft to the signed-in admin only.
 *
 * `sendCRMBroadcastSelfTest` reads the recipient from the session, so this
 * action cannot be pointed at somebody else by a crafted payload. Marking the
 * subject as a test happens in that shared path.
 */
export async function sendCivicNewsletterTest(
  draft: NewsletterBroadcastDraft
): Promise<NewsletterBroadcastResult> {
  const blocked = sendBlockedInE2E();
  if (blocked) return blocked;

  const invalid = validateDraft(draft);
  if (invalid) return { success: false, error: invalid };

  const { subject, body } = buildBulletinBroadcast({
    title: draft.title,
    dateLabel: draft.dateLabel,
    description: draft.description,
    body: draft.body,
    pdfUrl: draft.pdfUrl,
    archiveUrl: draft.archiveUrl,
    slug: draft.slug?.trim() || slugifyNewsletter(draft.title) || 'bulletin',
  });

  const result = await sendCRMBroadcastSelfTest({ subject, body });
  return {
    success: result.success,
    error: result.error,
    testRecipient: result.recipient,
  };
}

/**
 * Number of people a bulletin would reach.
 *
 * `newsletterConfirmedOnly` is the newsletter gate: explicit chapter consent
 * (`do_not_email = false`) plus a completed double opt-in. It is counted through
 * the same resolver the send uses, so the number in the dialog is the number
 * the campaign will target.
 */
export async function getCivicNewsletterAudience(): Promise<{
  count: number;
  excludedCount: number;
}> {
  return getBroadcastRecipientCount({ newsletterConfirmedOnly: true });
}

/**
 * Email a published bulletin through the existing CRM broadcast sender.
 *
 * The source slug is persisted on the broadcast row. It is both the campaign
 * log's link back to the issue and the idempotency key: a unique index refuses a
 * second real send of the same bulletin before any provider call is made.
 */
export async function sendCivicNewsletterBroadcast(
  slug: string
): Promise<NewsletterBroadcastResult> {
  const blocked = sendBlockedInE2E();
  if (blocked) return blocked;

  const cleanSlug = slug.trim();
  if (!cleanSlug) return { success: false, error: 'Choose a bulletin before sending.' };

  // Outside the try: an unauthenticated caller must be redirected by the admin
  // gate, not turned into a generic "could not send" result that swallows the
  // redirect signal.
  const { adminClient } = await requireAdmin();

  try {
    const { data, error } = await adminClient
      .from('newsletters')
      .select('*')
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: 'That bulletin no longer exists.' };

    const newsletter = data as {
      slug: string;
      title: string;
      date_label: string;
      description: string;
      body: string | null;
      pdf_url: string | null;
      archive_url: string | null;
      published_at: string | null;
    };

    if (newsletterPublicationState(newsletter.published_at) === 'scheduled') {
      return {
        success: false,
        error:
          'This issue is scheduled for a future date. Wait until it is published before emailing it to the list.',
      };
    }

    const { subject, body } = buildBulletinBroadcast({
      title: newsletter.title,
      dateLabel: newsletter.date_label,
      description: newsletter.description,
      body: newsletter.body,
      pdfUrl: newsletter.pdf_url,
      archiveUrl: newsletter.archive_url,
      slug: newsletter.slug,
    });

    const result = await sendCRMBroadcast({
      subject,
      body,
      newsletterConfirmedOnly: true,
      sourceNewsletterSlug: newsletter.slug,
    });

    return {
      success: result.success,
      error: result.error,
      warning: result.warning,
      recipientCount: result.recipientCount,
      broadcastId: result.broadcastId,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send the bulletin.',
    };
  }
}
