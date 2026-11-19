import { ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { AdminNotice } from '@/components/admin/AdminNotice';
import {
  type AdminAuditOperation,
  adminAuditActionLabel,
  adminAuditOutcomeLabel,
  adminAuditTargetTypeLabel,
  formatAdminAuditTimestamp,
} from '@/lib/admin-audit-read';

const OUTCOME_BADGE: Record<string, string> = {
  success: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  failure: 'border-red-300 bg-red-50 text-red-800',
  denied: 'border-amber-300 bg-amber-50 text-amber-900',
};

function jsonText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return null;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border py-3 last:border-b-0 sm:grid sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 min-w-0 break-words text-sm text-foreground sm:mt-0">{children}</dd>
    </div>
  );
}

function JsonPanel({ title, value }: { title: string; value: unknown }) {
  const text = jsonText(value);
  return (
    <section className="border border-border bg-surface-card">
      <h2 className="border-b border-border px-4 py-3 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {title}
      </h2>
      {text ? (
        <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[11px] leading-relaxed text-foreground">
          {text}
        </pre>
      ) : (
        <p className="p-4 text-sm text-muted-foreground">No snapshot recorded.</p>
      )}
    </section>
  );
}

export function AdminAuditDetail({ operation }: { operation: AdminAuditOperation }) {
  return (
    <div className="space-y-6">
      <Link
        href="/admin/audit"
        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-on-dark"
      >
        <ArrowLeft size={13} aria-hidden="true" />
        Back to audit log
      </Link>

      <header className="border-b border-border pb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            <ShieldCheck size={12} aria-hidden="true" />
            Read-only audit record
          </span>
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
              OUTCOME_BADGE[operation.outcome] ??
              'border-border bg-surface-muted text-muted-foreground'
            }`}
          >
            {adminAuditOutcomeLabel(operation.outcome)}
          </span>
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
          {adminAuditActionLabel(operation.action)}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {operation.target_label || operation.target_id} ·{' '}
          {adminAuditTargetTypeLabel(operation.target_type)}
        </p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {formatAdminAuditTimestamp(operation.created_at)}
        </p>
      </header>

      <AdminNotice>
        This record is append-only. The explorer can read it but cannot edit or delete it; the
        database rejects both operations even for the service role.
      </AdminNotice>

      <section className="border border-border bg-surface-card px-4">
        <dl>
          <Field label="Operation ID">
            <span className="font-mono text-xs">{operation.id}</span>
          </Field>
          <Field label="Actor">
            <span className="block">{operation.actor_email || 'No email recorded'}</span>
            <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
              {operation.actor_user_id}
            </span>
          </Field>
          <Field label="Action">
            <span className="block">{adminAuditActionLabel(operation.action)}</span>
            <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
              {operation.action}
            </span>
          </Field>
          <Field label="Target">
            <span className="block">{operation.target_label || operation.target_id}</span>
            <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
              {adminAuditTargetTypeLabel(operation.target_type)} · {operation.target_id}
            </span>
          </Field>
          <Field label="MFA level">
            <span className="font-mono text-xs uppercase">{operation.mfa_level}</span>
          </Field>
          <Field label="Outcome">
            <span>{adminAuditOutcomeLabel(operation.outcome)}</span>
          </Field>
          {operation.error ? (
            <Field label="Error">
              <span className="whitespace-pre-wrap text-destructive">{operation.error}</span>
            </Field>
          ) : null}
        </dl>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <JsonPanel title="Before" value={operation.before} />
        <JsonPanel title="After" value={operation.after} />
        <JsonPanel title="Metadata" value={operation.metadata} />
      </div>
    </div>
  );
}
