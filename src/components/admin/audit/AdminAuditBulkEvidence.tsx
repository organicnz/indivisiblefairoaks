import { ShieldCheck } from 'lucide-react';
import type { AdminAuditBulkEvidence } from '@/lib/admin-audit-bulk-evidence';

/** Keep the structured DOM bounded; the raw JSON fallback retains every row. */
const MAX_VISIBLE_CONTACTS = 100;

function countText(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('en-US');
}

function CountCard({ label, value, note }: { label: string; value: number | null; note: string }) {
  return (
    <div className="bg-surface-card px-4 py-4">
      <dt className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1">
        <span className="block font-display text-2xl font-semibold tracking-[-0.03em] text-foreground">
          {countText(value)}
        </span>
        <span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">
          {value === null ? 'Not recorded' : note}
        </span>
      </dd>
    </div>
  );
}

export function AdminAuditBulkEvidenceView({ evidence }: { evidence: AdminAuditBulkEvidence }) {
  const affectedWithoutSnapshot =
    evidence.affected !== null && evidence.contacts.length < evidence.affected
      ? evidence.affected - evidence.contacts.length
      : 0;
  const visibleContacts = evidence.contacts.slice(0, MAX_VISIBLE_CONTACTS);

  return (
    <section
      aria-labelledby="bulk-operation-evidence-heading"
      className="overflow-hidden rounded-2xl border border-border bg-surface-card"
    >
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <ShieldCheck
            size={16}
            className="text-primary dark:text-primary-on-dark"
            aria-hidden="true"
          />
          <h2
            id="bulk-operation-evidence-heading"
            className="font-display text-xl font-semibold tracking-[-0.02em] text-foreground"
          >
            Bulk operation evidence
          </h2>
        </div>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Counts from the operation metadata and field-level evidence from the recorded before/after
          snapshots. Values the record does not establish are left as not recorded.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-4">
        <CountCard label="Requested" value={evidence.requested} note="Selected for the operation" />
        <CountCard label="Affected" value={evidence.affected} note="Found when it ran" />
        <CountCard
          label={evidence.updatedLabel}
          value={evidence.updated}
          note="Reported by the database"
        />
        <CountCard
          label="Not affected"
          value={evidence.notAffected}
          note="Requested minus affected"
        />
      </dl>

      <div className="px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
              Per-contact before / after
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {evidence.contacts.length === 1
                ? '1 contact with recorded snapshots.'
                : `${evidence.contacts.length.toLocaleString('en-US')} contacts with recorded snapshots.`}
            </p>
            {evidence.contacts.length > MAX_VISIBLE_CONTACTS ? (
              <p className="mt-1 text-[10px] font-medium text-amber-800">
                Showing the first {MAX_VISIBLE_CONTACTS.toLocaleString('en-US')}; the raw JSON
                fallback below retains the full set.
              </p>
            ) : null}
          </div>
          {affectedWithoutSnapshot > 0 ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-900">
              {affectedWithoutSnapshot.toLocaleString('en-US')}{' '}
              {affectedWithoutSnapshot === 1 ? 'affected contact has' : 'affected contacts have'} no
              before/after snapshot.
            </p>
          ) : null}
        </div>

        {evidence.contacts.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border bg-surface-muted/40 px-4 py-6 text-sm text-muted-foreground">
            No contact-level before/after snapshots were recorded for this operation. The raw JSON
            fallback below remains available.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {visibleContacts.map((contact) => {
              const heading = contact.name || contact.email || contact.id;
              return (
                <article
                  key={contact.id}
                  className="overflow-hidden rounded-xl border border-border"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border bg-surface-muted/40 px-4 py-3">
                    <div className="min-w-0">
                      <h4 className="break-words text-sm font-semibold text-foreground">
                        {heading}
                      </h4>
                      {contact.name || contact.email ? (
                        <p className="mt-0.5 break-all font-mono text-[10px] text-muted-foreground">
                          {contact.id}
                        </p>
                      ) : null}
                      {contact.name && contact.email ? (
                        <p className="mt-0.5 break-words text-xs text-muted-foreground">
                          {contact.email}
                        </p>
                      ) : null}
                    </div>
                    {contact.deleted ? (
                      <span className="inline-flex rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-800">
                        Deleted
                      </span>
                    ) : null}
                  </div>

                  {contact.fields.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[34rem] border-collapse text-left text-xs">
                        <thead className="bg-surface-muted">
                          <tr className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                            <th scope="col" className="px-4 py-2">
                              Field
                            </th>
                            <th scope="col" className="px-4 py-2">
                              Before
                            </th>
                            <th scope="col" className="px-4 py-2">
                              After
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {contact.fields.map((field) => (
                            <tr key={field.key} className="align-top">
                              <th
                                scope="row"
                                className="w-36 px-4 py-2 font-medium text-muted-foreground"
                              >
                                {field.label}
                              </th>
                              <td className="break-words px-4 py-2 text-foreground">
                                {field.before}
                              </td>
                              <td className="break-words px-4 py-2 text-foreground">
                                {field.after}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="px-4 py-3 text-xs text-muted-foreground">
                      No recorded field values differ for this contact.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
