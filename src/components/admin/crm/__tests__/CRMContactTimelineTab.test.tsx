// @vitest-environment node

import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CRMContactTimelineTab } from '@/components/admin/crm/CRMContactTimelineTab';
import type { CRMActivityWithDelivery } from '@/types/crm';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/crm/c1',
}));

vi.mock('@/components/admin/ConfirmAction', () => ({
  ConfirmAction: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/admin/crm/CRMPager', () => ({
  CRMPager: () => null,
}));

const activities = [
  {
    id: 'a1',
    contact_id: 'c1',
    type: 'email_sent',
    title: 'Sent Email: Update',
    description: 'A direct update.',
    created_at: '2026-11-20T12:00:00.000Z',
    metadata: { resend_id: 'res_1' },
    delivery: {
      status: 'complained',
      acceptedAt: '2026-11-20T12:00:00.000Z',
      deliveredAt: '2026-11-20T12:01:00.000Z',
      bouncedAt: null,
      complainedAt: '2026-11-20T12:05:00.000Z',
      events: [
        { eventType: 'delivered', occurredAt: '2026-11-20T12:01:00.000Z' },
        { eventType: 'complained', occurredAt: '2026-11-20T12:05:00.000Z' },
      ],
    },
  },
  {
    id: 'a2',
    contact_id: 'c1',
    type: 'email_sent',
    title: 'Sent Email: Bounced',
    description: 'This send could not be delivered.',
    created_at: '2026-11-19T12:00:00.000Z',
    metadata: { resend_id: 'res_2' },
    delivery: {
      status: 'bounced',
      acceptedAt: '2026-11-19T12:00:00.000Z',
      deliveredAt: null,
      bouncedAt: '2026-11-19T12:03:00.000Z',
      complainedAt: null,
      events: [{ eventType: 'bounced', occurredAt: '2026-11-19T12:03:00.000Z' }],
    },
  },
  {
    id: 'a3',
    contact_id: 'c1',
    type: 'email_bounced',
    title: 'Email Bounced — Suppressed',
    description: 'Resend reported a permanent bounce.',
    created_at: '2026-11-18T12:00:00.000Z',
    metadata: { event: 'email.bounced' },
  },
] as unknown as CRMActivityWithDelivery[];

function renderTimeline() {
  return renderToStaticMarkup(
    <CRMContactTimelineTab
      activities={activities}
      activityPage={1}
      activityPageSize={50}
      activityCount={3}
      editingNoteId={null}
      setEditingNoteId={vi.fn()}
      editingNoteTitle=""
      setEditingNoteTitle={vi.fn()}
      editingNoteDesc=""
      setEditingNoteDesc={vi.fn()}
      updatingNote={false}
      handleUpdateNote={vi.fn()}
      handleStartEditNote={vi.fn()}
      handleDeleteNote={vi.fn()}
    />
  );
}

describe('CRMContactTimelineTab direct-email delivery status', () => {
  it('shows accepted, delivered, bounced and complained stages', () => {
    const html = renderTimeline();

    expect(html).toContain('Accepted');
    expect(html).toContain('Delivered');
    expect(html).toContain('Bounced');
    expect(html).toContain('Complained');
    expect(html).toContain('data-status="accepted"');
    expect(html).toContain('data-status="delivered"');
    expect(html).toContain('data-status="complained"');
    expect(html).toContain('data-status="bounced"');
  });

  it('keeps the suppression event as a distinct timeline row', () => {
    const html = renderTimeline();

    expect(html).toContain('Email Bounced — Suppressed');
    expect(html).toContain('Resend reported a permanent bounce.');
  });
});
