import { pageMetadata } from '@/lib/metadata';
import { CRMSegmentManager } from '@/components/admin/crm/CRMSegmentManager';
import { getCRMSegments } from '@/lib/actions/crm';
import { requireAdmin } from '@/lib/admin-auth';

// Deliberate Cache Components opt-out (Block): admin surface behind requireAdmin() session gate.
export const instant = false;

export async function generateMetadata() {
  return pageMetadata({
    title: 'Segments — CRM',
    description: 'Saved audience rules for broadcasts and audits.',
    path: '/admin/crm/segments',
    robots: { index: false, follow: false },
  });
}

export default async function AdminCRMSegmentsPage() {
  await requireAdmin();
  const { segments, truncated } = await getCRMSegments();
  return <CRMSegmentManager initialSegments={segments} truncated={truncated} />;
}
