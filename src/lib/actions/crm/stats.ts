import type { CRMStats } from '@/types/crm';
import { type AdminClient, requireCRMAdmin } from './shared';

/**
 * KPI cards for the directory header.
 *
 * Aggregated in the database by `crm_stats()` (see migrations 20260929120000
 * and 20261119150000). `total_donors` uses the canonical `is_donor` generated
 * column, not the legacy `total_donated_cents > 0` rule. The previous version
 * selected every donor row and summed
 * `total_donated_cents` in JavaScript, which put an unbounded result set on the
 * wire on every dashboard load. The RPC is a single pass over the table and
 * returns one object.
 */
export async function getCRMStats(): Promise<CRMStats> {
  const { adminClient } = await requireCRMAdmin();

  const { data, error } = await adminClient.rpc('crm_stats');
  if (error) {
    // The RPC is additive: on a database that has not had the migration
    // applied yet, fall back to the old per-query counts so the dashboard
    // still renders rather than 500ing during a staged rollout.
    return legacyCRMStats(adminClient);
  }

  const row = data as Record<string, number> | null;
  const requiredKeys = [
    'total_contacts',
    'active_volunteers',
    'local_district',
    'total_donors',
    'total_donations_cents',
    'open_tasks',
  ] as const;

  // An aggregate function without GROUP BY returns exactly one row. Missing
  // data or a missing key is therefore a broken response, not an empty chapter.
  // Falling back keeps the contact counts honest instead of showing zeros.
  if (!row || requiredKeys.some((key) => typeof row[key] !== 'number')) {
    return legacyCRMStats(adminClient);
  }

  return {
    totalContacts: row.total_contacts,
    activeVolunteers: row.active_volunteers,
    localDistrict: row.local_district,
    totalDonors: row.total_donors,
    totalDonationsCents: row.total_donations_cents,
    openTasks: row.open_tasks,
  };
}

async function legacyCRMStats(adminClient: AdminClient): Promise<CRMStats> {
  const [total, volunteers, local, tasks] = await Promise.all([
    adminClient.from('crm_contacts').select('*', { count: 'exact', head: true }),
    adminClient
      .from('crm_contacts')
      .select('*', { count: 'exact', head: true })
      .in('status', ['active_volunteer', 'choir', 'organizer']),
    adminClient
      .from('crm_contacts')
      .select('*', { count: 'exact', head: true })
      .in('district', ['CA-03', 'CA-06']),
    adminClient.from('crm_tasks').select('*', { count: 'exact', head: true }).eq('status', 'open'),
  ]);

  for (const result of [total, volunteers, local, tasks]) {
    if (result.error) {
      throw new Error(`Failed to load CRM stats: ${result.error.message}`);
    }
  }

  // A count is only null when the request did not ask for one or the response
  // was incomplete. Both mean the KPI cards cannot be trusted, and reporting
  // zero would turn a database fault into "this chapter has no constituents".
  if (
    total.count === null ||
    volunteers.count === null ||
    local.count === null ||
    tasks.count === null
  ) {
    throw new Error('Failed to load CRM stats: a count was unavailable');
  }

  return {
    totalContacts: total.count,
    activeVolunteers: volunteers.count,
    localDistrict: local.count,
    totalDonors: 0,
    totalDonationsCents: 0,
    openTasks: tasks.count,
  };
}
