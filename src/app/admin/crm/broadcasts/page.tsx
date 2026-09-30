import { CRMBroadcastComposer } from '@/components/admin/crm/CRMBroadcastComposer';
import {
  getCRMBroadcastDrafts,
  getCRMBroadcasts,
  getCRMExistingTags,
  getCRMSegments,
} from '@/lib/actions/crm';
import { requireAdmin } from '@/lib/admin-auth';

// Deliberate Cache Components opt-out (Block): admin surface behind requireAdmin() session gate.
export const instant = false;

export async function generateMetadata() {
  return {
    title: 'Campaign Broadcasts — Civic CRM · Indivisible Fair Oaks',
    description:
      'Compose and dispatch segmented email blasts to activists and supporters via Resend.',
    robots: { index: false, follow: false },
  };
}

export default async function AdminCRMBroadcastsPage() {
  await requireAdmin();
  const [broadcasts, drafts, segments, existingTags] = await Promise.all([
    getCRMBroadcasts(),
    getCRMBroadcastDrafts(),
    getCRMSegments(),
    getCRMExistingTags(),
  ]);

  return (
    <CRMBroadcastComposer
      initialBroadcasts={broadcasts}
      initialDrafts={drafts}
      segments={segments}
      existingTags={existingTags}
    />
  );
}
