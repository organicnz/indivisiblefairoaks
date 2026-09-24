import { notFound } from 'next/navigation';
import { CRMDetailClient } from '@/components/admin/crm/CRMDetailClient';
import { getCRMContactDetail } from '@/lib/actions/crm';
import { requireAdmin } from '@/lib/admin-auth';

// Deliberate Cache Components opt-out (Block): admin surface behind requireAdmin() session gate.
export const instant = false;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { contact } = await getCRMContactDetail(id);
    const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email;
    return {
      title: `${name} — Civic CRM · Indivisible Fair Oaks`,
      description: `Constituent profile, engagement timeline, and communication history for ${name}.`,
      robots: { index: false, follow: false },
    };
  } catch {
    return {
      title: 'Constituent Profile — Admin · Indivisible Fair Oaks',
      description: 'Constituent details in Civic CRM.',
      robots: { index: false, follow: false },
    };
  }
}

export default async function AdminCRMDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  try {
    const { contact, activities, tasks } = await getCRMContactDetail(id);
    return <CRMDetailClient contact={contact} activities={activities} tasks={tasks} />;
  } catch {
    notFound();
  }
}
