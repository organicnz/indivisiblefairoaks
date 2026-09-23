'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { brandShell, escapeHtml, safeSubject, sendEmail } from '@/lib/email';
import { env } from '@/lib/env';
import type { Database } from '@/types/supabase';

export type CRMContact = Database['public']['Tables']['crm_contacts']['Row'];
export type CRMContactInsert = Database['public']['Tables']['crm_contacts']['Insert'];
export type CRMContactUpdate = Database['public']['Tables']['crm_contacts']['Update'];
export type CRMActivity = Database['public']['Tables']['crm_activities']['Row'];
export type CRMBroadcast = Database['public']['Tables']['crm_broadcasts']['Row'];

const contactSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().trim().toLowerCase().email(),
  first_name: z.string().max(100).nullable().optional(),
  last_name: z.string().max(100).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  zip_code: z.string().max(20).nullable().optional(),
  district: z.string().max(20).default('CA-06'),
  status: z
    .enum(['active_volunteer', 'supporter', 'donor', 'choir', 'organizer', 'inactive'])
    .default('supporter'),
  tags: z.array(z.string()).default([]),
  notes: z.string().nullable().optional(),
});

export interface CRMStats {
  totalContacts: number;
  activeVolunteers: number;
  localDistrict: number;
  totalDonors: number;
  totalDonationsCents: number;
}

export async function getCRMStats(): Promise<CRMStats> {
  const { adminClient } = await requireAdmin();

  const [
    { count: totalContacts },
    { count: activeVolunteers },
    { count: localDistrict },
    { data: donorRows },
  ] = await Promise.all([
    adminClient.from('crm_contacts').select('*', { count: 'exact', head: true }),
    adminClient
      .from('crm_contacts')
      .select('*', { count: 'exact', head: true })
      .in('status', ['active_volunteer', 'choir', 'organizer']),
    adminClient
      .from('crm_contacts')
      .select('*', { count: 'exact', head: true })
      .in('district', ['CA-03', 'CA-06']),
    adminClient.from('crm_contacts').select('total_donated_cents').gt('total_donated_cents', 0),
  ]);

  const totalDonationsCents = (donorRows || []).reduce(
    (sum, r) => sum + (r.total_donated_cents || 0),
    0
  );

  return {
    totalContacts: totalContacts ?? 0,
    activeVolunteers: activeVolunteers ?? 0,
    localDistrict: localDistrict ?? 0,
    totalDonors: donorRows?.length ?? 0,
    totalDonationsCents,
  };
}

export interface GetCRMContactsParams {
  query?: string;
  status?: string;
  district?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
}

export async function getCRMContacts({
  query = '',
  status = '',
  district = '',
  tag = '',
  page = 1,
  pageSize = 50,
}: GetCRMContactsParams = {}): Promise<{ contacts: CRMContact[]; totalCount: number }> {
  const { adminClient } = await requireAdmin();

  let qb = adminClient.from('crm_contacts').select('*', { count: 'exact' });

  if (status && status !== 'all') {
    qb = qb.eq('status', status);
  }

  if (district && district !== 'all') {
    qb = qb.eq('district', district);
  }

  if (tag && tag !== 'all') {
    qb = qb.contains('tags', [tag]);
  }

  const q = query.trim();
  if (q) {
    qb = qb.or(
      `email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,city.ilike.%${q}%,notes.ilike.%${q}%`
    );
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await qb.order('created_at', { ascending: false }).range(from, to);

  if (error) {
    throw new Error(`Failed to load CRM contacts: ${error.message}`);
  }

  return {
    contacts: data || [],
    totalCount: count || 0,
  };
}

export async function getCRMContactDetail(
  id: string
): Promise<{ contact: CRMContact; activities: CRMActivity[] }> {
  const { adminClient } = await requireAdmin();

  const [{ data: contact, error: contactError }, { data: activities, error: actError }] =
    await Promise.all([
      adminClient.from('crm_contacts').select('*').eq('id', id).single(),
      adminClient
        .from('crm_activities')
        .select('*')
        .eq('contact_id', id)
        .order('created_at', { ascending: false }),
    ]);

  if (contactError || !contact) {
    throw new Error('Contact not found');
  }

  if (actError) {
    throw new Error(`Failed to load contact activities: ${actError.message}`);
  }

  return {
    contact,
    activities: activities || [],
  };
}

export async function saveCRMContact(
  rawInput: z.input<typeof contactSchema>
): Promise<{ success: boolean; contactId?: string; error?: string }> {
  const { adminClient, adminUserId } = await requireAdmin();

  const parsed = contactSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const { id, ...data } = parsed.data;
  const normalizedEmail = data.email.trim().toLowerCase();

  if (id) {
    // Update existing contact
    const { data: updated, error } = await adminClient
      .from('crm_contacts')
      .update({
        ...data,
        email: normalizedEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };

    await adminClient.from('crm_activities').insert({
      contact_id: id,
      type: 'status_change',
      title: 'Constituent Profile Updated',
      description: `Updated details and status (${data.status})`,
      created_by: adminUserId,
    });

    revalidatePath('/admin/crm');
    revalidatePath(`/admin/crm/${id}`);
    return { success: true, contactId: updated.id };
  }

  // Insert new contact
  const { data: created, error } = await adminClient
    .from('crm_contacts')
    .insert({
      ...data,
      email: normalizedEmail,
      source: 'manual',
    })
    .select('id')
    .single();

  if (error) return { success: false, error: error.message };

  await adminClient.from('crm_activities').insert({
    contact_id: created.id,
    type: 'note',
    title: 'Constituent Created',
    description: 'Manually added to CRM directory',
    created_by: adminUserId,
  });

  revalidatePath('/admin/crm');
  return { success: true, contactId: created.id };
}

export async function deleteCRMContact(id: string): Promise<{ success: boolean; error?: string }> {
  const { adminClient } = await requireAdmin();

  const { error } = await adminClient.from('crm_contacts').delete().eq('id', id);
  if (error) return { success: false, error: error.message };

  revalidatePath('/admin/crm');
  return { success: true };
}

export async function addCRMNote({
  contactId,
  title,
  description,
}: {
  contactId: string;
  title: string;
  description: string;
}): Promise<{ success: boolean; error?: string }> {
  const { adminClient, adminUserId } = await requireAdmin();

  if (!title.trim()) return { success: false, error: 'Title is required' };

  const { error } = await adminClient.from('crm_activities').insert({
    contact_id: contactId,
    type: 'note',
    title: title.trim(),
    description: description.trim() || null,
    created_by: adminUserId,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath(`/admin/crm/${contactId}`);
  return { success: true };
}

export async function sendCRMDirectEmail({
  contactId,
  subject,
  message,
}: {
  contactId: string;
  subject: string;
  message: string;
}): Promise<{ success: boolean; error?: string }> {
  const { adminClient, adminUserId } = await requireAdmin();

  if (!subject.trim() || !message.trim()) {
    return { success: false, error: 'Subject and message are required' };
  }

  const { data: contact, error: fetchError } = await adminClient
    .from('crm_contacts')
    .select('id, email, first_name, last_name')
    .eq('id', contactId)
    .single();

  if (fetchError || !contact) {
    return { success: false, error: 'Contact not found' };
  }

  const cleanSubject = safeSubject(subject.trim());
  const recipientName =
    [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Supporter';
  const escapedMessage = escapeHtml(message.trim()).replace(/\n/g, '<br />');

  const html = brandShell({
    eyebrow: 'Community Update',
    body: `
      <p style="margin:0 0 16px;color:#F1F5F9;font-size:16px;">Dear ${escapeHtml(recipientName)},</p>
      <div style="margin:0 0 20px;padding:20px;background:#0F172A;border-radius:12px;border-left:3px solid #2563EB;color:#F1F5F9;font-size:14px;line-height:1.7;">
        ${escapedMessage}
      </div>
      <p style="margin:24px 0 0;color:#94A3B8;font-size:13px;line-height:1.5;">
        In solidarity,<br />
        <strong style="color:#FFFFFF;">Indivisible Fair Oaks-Carmichael Organizing Team</strong>
      </p>
    `.trim(),
    footer: 'You received this direct civic update from Indivisible Fair Oaks-Carmichael.',
  });

  const sendResult = await sendEmail({
    to: contact.email,
    subject: cleanSubject,
    html,
    text: `${message.trim()}\n\n--\nIndivisible Fair Oaks-Carmichael\nhttps://indivisiblefairoaks.org`,
    replyTo: env.ADMIN_ORDER_EMAIL || 'contact@indivisiblefairoaks.org',
    tags: [{ name: 'type', value: 'crm-direct' }],
  });

  if (!sendResult.ok) {
    return { success: false, error: `Email dispatch failed: ${sendResult.error}` };
  }

  const now = new Date().toISOString();

  await Promise.all([
    adminClient.from('crm_contacts').update({ last_contacted_at: now }).eq('id', contactId),
    adminClient.from('crm_activities').insert({
      contact_id: contactId,
      type: 'email_sent',
      title: `Sent Email: ${cleanSubject}`,
      description: message.trim(),
      metadata: { resend_id: sendResult.id, subject: cleanSubject },
      created_by: adminUserId,
    }),
  ]);

  revalidatePath(`/admin/crm/${contactId}`);
  return { success: true };
}

export async function sendCRMBroadcast({
  subject,
  body,
  targetTags = [],
  targetStatus = [],
  targetDistricts = [],
}: {
  subject: string;
  body: string;
  targetTags?: string[];
  targetStatus?: string[];
  targetDistricts?: string[];
}): Promise<{ success: boolean; recipientCount?: number; broadcastId?: string; error?: string }> {
  const { adminClient, adminUserId } = await requireAdmin();

  if (!subject.trim() || !body.trim()) {
    return { success: false, error: 'Subject and message body are required' };
  }

  let qb = adminClient.from('crm_contacts').select('id, email, first_name, last_name');

  if (targetStatus.length > 0) {
    qb = qb.in('status', targetStatus);
  }

  if (targetDistricts.length > 0) {
    qb = qb.in('district', targetDistricts);
  }

  if (targetTags.length > 0) {
    qb = qb.contains('tags', targetTags);
  }

  const { data: recipients, error: recError } = await qb;
  if (recError) {
    return { success: false, error: `Failed to resolve recipients: ${recError.message}` };
  }

  if (!recipients || recipients.length === 0) {
    return { success: false, error: 'No constituents match the selected criteria' };
  }

  // Insert draft broadcast record
  const { data: broadcast, error: bcError } = await adminClient
    .from('crm_broadcasts')
    .insert({
      subject: safeSubject(subject.trim()),
      body: body.trim(),
      target_tags: targetTags,
      target_status: targetStatus,
      target_districts: targetDistricts,
      recipient_count: recipients.length,
      status: 'sending',
    })
    .select('id')
    .single();

  if (bcError || !broadcast) {
    return { success: false, error: 'Failed to create broadcast log' };
  }

  const cleanSubject = safeSubject(subject.trim());
  const escapedBody = escapeHtml(body.trim()).replace(/\n/g, '<br />');

  // Dispatch emails (batch with small pauses to avoid bursting)
  let successfulSends = 0;
  const now = new Date().toISOString();

  for (const recipient of recipients) {
    const recipientName =
      [recipient.first_name, recipient.last_name].filter(Boolean).join(' ') || 'Supporter';
    const html = brandShell({
      eyebrow: 'Chapter Broadcast',
      body: `
        <p style="margin:0 0 16px;color:#F1F5F9;font-size:16px;">Hello ${escapeHtml(recipientName)},</p>
        <div style="margin:0 0 20px;padding:20px;background:#0F172A;border-radius:12px;border-left:3px solid #2563EB;color:#F1F5F9;font-size:14px;line-height:1.7;">
          ${escapedBody}
        </div>
        <p style="margin:24px 0 0;color:#94A3B8;font-size:13px;line-height:1.5;">
          Indivisible Fair Oaks-Carmichael Organizing Team<br />
          <a href="https://indivisiblefairoaks.org" style="color:#60A5FA;text-decoration:none;">indivisiblefairoaks.org</a>
        </p>
      `.trim(),
      footer:
        'You received this community broadcast as a registered supporter or volunteer. Reply UNSUBSCRIBE to opt out.',
    });

    const res = await sendEmail({
      to: recipient.email,
      subject: cleanSubject,
      html,
      text: `${body.trim()}\n\n--\nIndivisible Fair Oaks-Carmichael\nhttps://indivisiblefairoaks.org\n\nReply UNSUBSCRIBE to opt out of broadcasts.`,
      replyTo: env.ADMIN_ORDER_EMAIL || 'contact@indivisiblefairoaks.org',
      tags: [
        { name: 'type', value: 'crm-broadcast' },
        { name: 'broadcast_id', value: broadcast.id },
      ],
      // Bulk-sender compliance (Gmail/Yahoo): List-Unsubscribe header plus
      // an honest opt-out path in body/footer. Full one-click HTTPS
      // unsubscribe is the follow-up if broadcast volume ever grows.
      headers: {
        'List-Unsubscribe': `<mailto:${env.ADMIN_ORDER_EMAIL || 'contact@indivisiblefairoaks.org'}?subject=${encodeURIComponent('Unsubscribe')}>`,
      },
    });

    if (res.ok) {
      successfulSends += 1;
      await adminClient.from('crm_activities').insert({
        contact_id: recipient.id,
        type: 'email_sent',
        title: `Broadcast: ${cleanSubject}`,
        description: `Delivered via campaign #${broadcast.id}`,
        metadata: { broadcast_id: broadcast.id, resend_id: res.id },
        created_by: adminUserId,
      });
    }
  }

  await adminClient
    .from('crm_broadcasts')
    .update({
      status: successfulSends > 0 ? 'sent' : 'failed',
      recipient_count: successfulSends,
      sent_at: now,
    })
    .eq('id', broadcast.id);

  revalidatePath('/admin/crm');
  revalidatePath('/admin/crm/broadcasts');

  return {
    success: successfulSends > 0,
    recipientCount: successfulSends,
    broadcastId: broadcast.id,
  };
}

export async function triggerHistoricalCRMSync(): Promise<{
  success: boolean;
  syncedCount?: number;
  error?: string;
}> {
  const { adminClient } = await requireAdmin();

  const { data, error } = await adminClient.rpc('crm_sync_historical_records');
  if (error) {
    return { success: false, error: error.message };
  }

  const result = data as { contacts_synced?: number; activities_created?: number } | null;

  revalidatePath('/admin/crm');
  return {
    success: true,
    syncedCount: result?.contacts_synced ?? 0,
  };
}

export async function getCRMBroadcasts(): Promise<CRMBroadcast[]> {
  const { adminClient } = await requireAdmin();
  const { data, error } = await adminClient
    .from('crm_broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Failed to fetch broadcasts: ${error.message}`);
  }

  return data || [];
}

export async function getBroadcastRecipientCount({
  targetTags = [],
  targetStatus = [],
  targetDistricts = [],
}: {
  targetTags?: string[];
  targetStatus?: string[];
  targetDistricts?: string[];
}): Promise<number> {
  const { adminClient } = await requireAdmin();

  let qb = adminClient.from('crm_contacts').select('*', { count: 'exact', head: true });

  if (targetStatus.length > 0) {
    qb = qb.in('status', targetStatus);
  }

  if (targetDistricts.length > 0) {
    qb = qb.in('district', targetDistricts);
  }

  if (targetTags.length > 0) {
    qb = qb.contains('tags', targetTags);
  }

  const { count, error } = await qb;
  if (error) {
    throw new Error(`Failed to count broadcast recipients: ${error.message}`);
  }

  return count ?? 0;
}
