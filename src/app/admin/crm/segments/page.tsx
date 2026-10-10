import type { Metadata } from 'next';
import { CRMSegmentManager } from '@/components/admin/crm/CRMSegmentManager';
import { getCRMSegments } from '@/lib/actions/crm';
import { requireAdmin } from '@/lib/admin-auth';

// Deliberate Cache Components opt-out (Block): admin surface behind requireAdmin() session gate.
export const instant = false;

export const metadata: Metadata = {
  title: 'Segments — CRM · Indivisible Fair Oaks',
  description: 'Saved audience rules for broadcasts and audits.',
  robots: { index: false, follow: false },
};

export default async function AdminCRMSegmentsPage() {
  await requireAdmin();
  const { segments, truncated } = await getCRMSegments();
  return <CRMSegmentManager initialSegments={segments} truncated={truncated} />;
}
