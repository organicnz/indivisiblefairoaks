// @vitest-environment node

import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AdminAuditLossBanner } from '@/components/admin/AdminAuditLossBanner';

vi.mock('@/app/admin/actions', () => ({
  acknowledgeAdminAuditLoss: vi.fn(),
}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('AdminAuditLossBanner', () => {
  it('keeps a lost audit record visible with the required next steps', () => {
    const html = renderToStaticMarkup(
      <AdminAuditLossBanner reportedAt="2026-11-20T12:00:00.000Z" />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Audit trail incomplete');
    expect(html).toContain('could not be written to the audit log or queued for retry');
    expect(html).toContain('The operation itself is not rolled back');
    expect(html).toContain('Check the server diagnostics before retrying it');
    expect(html).toContain('2026-11-20 12:00 UTC');
    expect(html).toContain('href="/admin/audit"');
    expect(html).toContain('href="/admin/audit/outbox"');
    expect(html).toContain('Acknowledge and dismiss audit warning');
  });

  it('does not echo arbitrary cookie text as markup', () => {
    const html = renderToStaticMarkup(
      <AdminAuditLossBanner reportedAt="<script>alert(1)</script>" />
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
