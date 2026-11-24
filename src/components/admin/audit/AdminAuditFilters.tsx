import { Download, RotateCcw, Search } from 'lucide-react';
import Link from 'next/link';
import {
  ADMIN_AUDIT_ACTION_OPTIONS,
  ADMIN_AUDIT_OUTCOME_LABELS,
  ADMIN_AUDIT_TARGET_TYPE_OPTIONS,
  type AdminAuditFilters as AuditFilterValues,
  adminAuditHref,
} from '@/lib/admin-audit-read';

const inputClass =
  'mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground focus-visible:ring-2 focus-visible:ring-primary/40';
const labelClass =
  'block font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground';

export function AdminAuditFilters({ filters }: { filters: AuditFilterValues }) {
  return (
    <form
      method="get"
      action="/admin/audit"
      className="space-y-4 rounded-2xl border border-border bg-surface-card p-5 shadow-xs"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={labelClass}>
          Actor
          <input
            type="search"
            name="actor"
            defaultValue={filters.actor}
            placeholder="Email or user UUID"
            autoComplete="off"
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Action
          <select name="action" defaultValue={filters.action} className={inputClass}>
            <option value="">All actions</option>
            {ADMIN_AUDIT_ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Outcome
          <select name="outcome" defaultValue={filters.outcome} className={inputClass}>
            <option value="">All outcomes</option>
            {Object.entries(ADMIN_AUDIT_OUTCOME_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Target type
          <select name="targetType" defaultValue={filters.targetType} className={inputClass}>
            <option value="">All target types</option>
            {ADMIN_AUDIT_TARGET_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Target
          <input
            type="search"
            name="target"
            defaultValue={filters.target}
            placeholder="Target ID or label"
            autoComplete="off"
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Contact in bulk change
          <input
            type="search"
            name="contact"
            defaultValue={filters.contact}
            placeholder="Full contact UUID"
            autoComplete="off"
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          From (UTC)
          <input type="date" name="from" defaultValue={filters.from} className={inputClass} />
        </label>

        <label className={labelClass}>
          To (UTC)
          <input type="date" name="to" defaultValue={filters.to} className={inputClass} />
        </label>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white transition-colors hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Search size={13} aria-hidden="true" />
            Apply
          </button>
          <Link
            href="/admin/audit"
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-card px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <RotateCcw size={12} aria-hidden="true" />
            Reset
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Filters apply to the newest operations first. Dates and timestamps are UTC.
        </p>
        <a
          href={adminAuditHref('/admin/audit/export', filters)}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary transition-colors hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-on-dark"
        >
          <Download size={13} aria-hidden="true" />
          Export CSV
        </a>
      </div>
    </form>
  );
}
