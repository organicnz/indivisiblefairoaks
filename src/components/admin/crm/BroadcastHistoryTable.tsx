'use client';

import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Clock, Copy } from 'lucide-react';
import { Fragment } from 'react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { BroadcastDeliveryPanel } from '@/components/admin/crm/BroadcastDeliveryPanel';
import { CRMPager } from '@/components/admin/crm/CRMPager';
import { BROADCAST_HISTORY_PAGE_SIZE } from '@/lib/crm-limits';
import type { BroadcastMetrics, CRMBroadcast } from '@/types/crm';

export function BroadcastHistoryTable({
  broadcasts,
  metricsById = {},
  totalCount,
  testCount,
  expandedId,
  onToggleExpanded,
  onReuse,
  onMarkFailed,
  page,
  first,
  last,
  totalPages,
  params,
}: {
  broadcasts: CRMBroadcast[];
  /** SQL aggregates for this page, keyed by campaign id. */
  metricsById?: Record<string, BroadcastMetrics>;
  totalCount: number;
  testCount: number;
  expandedId: string | null;
  onToggleExpanded: (id: string | null) => void;
  onReuse: (broadcast: CRMBroadcast) => void;
  onMarkFailed: (id: string) => void;
  page: number;
  first: number;
  last: number;
  totalPages: number;
  params: URLSearchParams;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock size={16} className="text-muted-foreground" />
        <h2 className="font-display text-xs font-semibold tracking-[-0.01em] text-muted-foreground">
          Past campaigns &amp; dispatch history
          {/*
       The total, not `broadcasts.length`.

       The page size is 25 and this list has no "load more", so rendering the rows
       shown says "(25)" for a chapter that has sent seventy — which reads as
       "twenty-five campaigns exist" and is the reason a chapter believed its whole
       history had been deleted after losing access for a while.
    */}
          {totalCount > broadcasts.length ? (
            <>
              {' '}
              <span className="text-foreground font-black">{totalCount.toLocaleString()}</span>
            </>
          ) : (
            <> ({broadcasts.length})</>
          )}
        </h2>
      </div>

      {testCount > 0 && (
        <p className="text-xs text-amber-800">
          {`${testCount} ${testCount === 1 ? 'row is' : 'rows are'} a test sent to yourself. Nobody else received ${
            testCount === 1 ? 'it' : 'them'
          }.`}
        </p>
      )}

      {broadcasts.length === 0 ? (
        <div className="bg-surface-muted p-12 rounded-2xl border border-dashed border-border text-center text-xs text-muted-foreground">
          No broadcast campaigns sent yet. Compose your first campaign above!
        </div>
      ) : (
        <div className="bg-surface-card rounded-2xl border border-border shadow-xs overflow-hidden">
          {/*
                  `tabIndex={0}` + `role="region"` on the scroll container. An
                  `overflow-x-auto` element is no longer focusable by default in
                  Chrome or Firefox, so without it a keyboard user cannot scroll this
                  five-column table sideways at all on a narrow viewport — and this is
                  the table an organizer reads to find out what has already gone out.
                  Same pattern as `CRMContactList`'s directory table; see AGENTS.md.
                */}
          <section
            className="overflow-x-auto"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: WAI-ARIA scrollable region, see AGENTS.md "Scrollable regions must be focusable"
            tabIndex={0}
            aria-label="Campaign history"
          >
            <table className="w-full text-left text-xs">
              <caption className="sr-only">
                Past campaigns, newest first, with the audience each reached and its outcome
              </caption>
              <thead>
                <tr className="bg-surface-muted border-b border-border text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  <th scope="col" className="px-6 py-3">
                    Campaign Subject
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Audience Filters
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Recipients
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Sent Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-medium">
                {broadcasts.map((b) => {
                  const isExpanded = expandedId === b.id;
                  const metrics = metricsById[b.id];
                  // A campaign from before the ledger has no rows at all.
                  // Its stored counters are the only outcome it ever had,
                  // so they remain the fallback rather than rendering 0.
                  const ledger = metrics && metrics.recordedCount > 0 ? metrics : null;
                  const deliveredCount = ledger?.acceptedCount ?? b.sent_count;
                  const failedCount = ledger?.failedCount ?? b.failed_count;
                  const suppressedCount = ledger?.suppressedCount ?? 0;
                  const pendingCount = ledger?.pendingCount ?? 0;
                  const unresolvedCount = ledger?.unresolvedCount ?? 0;
                  const recipientCount = ledger?.recipientCount ?? b.recipient_count;
                  /*
                          A row an organizer may declare stuck.

                          The trigger is the state, not the clock: `sending`/`queued`
                          with no `marked_failed_at`. The timestamp is what *removes*
                          the control, because marking the row failed is what sets it —
                          so `marked_failed_at` here would look for the control's own
                          effect and it would never appear.

                          A test row is excluded: a self-test resolves in one request
                          and "stranded" is not a state it can be in.

                          The action itself refuses a row dispatched in the last
                          fifteen minutes, so a campaign that is merely slow reports
                          that refusal rather than being killed.
                        */
                  const canMarkStranded =
                    !b.test_only &&
                    (b.status === 'sending' || b.status === 'queued') &&
                    !b.marked_failed_at;
                  return (
                    <Fragment key={b.id}>
                      <tr
                        className={`transition-colors cursor-pointer hover:bg-surface-muted/70 ${
                          b.test_only ? 'bg-amber-50/50' : ''
                        }`}
                        onClick={() => onToggleExpanded(isExpanded ? null : b.id)}
                      >
                        <td className="px-6 py-4 font-bold text-foreground max-w-xs">
                          <span className="flex items-center gap-2">
                            <button
                              type="button"
                              className="p-0.5 text-muted-foreground hover:text-foreground shrink-0"
                              aria-label={isExpanded ? 'Collapse message' : 'Expand message'}
                              aria-expanded={isExpanded}
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleExpanded(isExpanded ? null : b.id);
                              }}
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            <span className="truncate">{b.subject}</span>
                            {b.test_only && (
                              <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-900">
                                Test
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {b.test_only ? (
                            // Never "All Constituents" for a preview. The row
                            // is saved with no audience filters at all, so
                            // rendering it the way a real campaign renders
                            // would tell the admin the whole list was mailed.
                            <span className="font-bold text-amber-800">
                              Nobody — sent only to you
                            </span>
                          ) : (
                            <>
                              {b.target_status.length > 0 &&
                                `Status: ${b.target_status.join(', ')} `}
                              {b.target_districts.length > 0 &&
                                `Districts: ${b.target_districts.join(', ')} `}
                              {b.target_tags.length > 0 && `Tags: ${b.target_tags.join(', ')}`}
                              {b.target_status.length === 0 &&
                                b.target_districts.length === 0 &&
                                b.target_tags.length === 0 &&
                                'All Constituents'}
                            </>
                          )}
                        </td>
                        <td className="px-6 py-4 font-bold text-foreground">
                          {b.test_only ? (
                            <span className="text-amber-800">1 (you)</span>
                          ) : (
                            recipientCount
                          )}
                          {!b.test_only && deliveredCount > 0 && (
                            // "Accepted by the provider" — not "delivered". Resend returning
                            // 2xx is an acceptance, not a delivery; bounces land later, and a
                            // claim of delivery would be a promise the system cannot keep.
                            <span className="ml-1.5 text-[10px] font-black text-emerald-700">
                              {deliveredCount} accepted
                            </span>
                          )}
                          {!b.test_only && failedCount > 0 && (
                            <span className="ml-1.5 text-[10px] font-black text-red-600">
                              {failedCount} did not send
                            </span>
                          )}
                          {!b.test_only && suppressedCount > 0 && (
                            <span className="ml-1.5 text-[10px] font-black text-amber-800">
                              {suppressedCount} suppressed
                            </span>
                          )}
                          {!b.test_only && pendingCount > 0 && (
                            <span className="ml-1.5 text-[10px] font-black text-blue-700">
                              {pendingCount} pending
                            </span>
                          )}
                          {!b.test_only && unresolvedCount > 0 && (
                            <span className="ml-1.5 text-[10px] font-bold text-muted-foreground">
                              {unresolvedCount} not recorded
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              b.test_only
                                ? 'bg-amber-100 text-amber-900'
                                : b.status === 'sent'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : b.status === 'sending'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {b.status === 'sent' && !b.test_only && <CheckCircle2 size={10} />}
                            {b.test_only ? 'test' : b.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {b.sent_at
                            ? new Date(b.sent_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : new Date(b.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-surface-muted/60">
                          <td colSpan={5} className="px-6 py-4 space-y-3">
                            <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line max-w-3xl border-l-2 border-primary pl-4">
                              {b.body || '(no message body stored)'}
                            </div>

                            <BroadcastDeliveryPanel broadcastId={b.id} metrics={metrics} />

                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onReuse(b);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-card border border-border text-xs font-bold text-foreground hover:bg-surface-muted hover:border-border transition-colors shadow-2xs"
                              >
                                <Copy
                                  size={13}
                                  className="text-primary dark:text-primary-on-dark"
                                />
                                Re-use as New Draft
                              </button>
                            </div>

                            {/*
                                    The documented recovery, made actionable. A row
                                    stuck at `sending` with `dispatched_at` set is the
                                    one state docs/crm-operations.md says must never be
                                    re-dispatched — clearing that flag re-mails everyone
                                    already delivered to. Until now the guidance was
                                    correct and unreachable: the composer had no control
                                    that could mark a row failed, so two organizers
                                    staring at a stuck campaign could do nothing or edit
                                    the database by hand.

                                    One-directional on purpose. `markCRMBroadcastFailed`
                                    can only move a row to `failed`, never back to a
                                    sendable state, and it refuses a row dispatched
                                    within the last fifteen minutes — so it cannot be
                                    used to cut short a send that is merely slow.
                                  */}
                            {canMarkStranded && (
                              <div className="max-w-3xl rounded-xl bg-amber-50 border border-amber-200 p-3">
                                <p className="text-xs font-bold text-amber-950">
                                  This campaign has not finished.
                                </p>
                                <p className="text-[11px] text-amber-900 mt-1 mb-3">
                                  {deliveredCount} of {recipientCount} accepted so far. If it is
                                  genuinely stuck, mark it failed — that re-sends nothing, and the
                                  remainder needs a new, narrower campaign. A campaign dispatched in
                                  the last fifteen minutes will be refused.
                                </p>
                                <ConfirmAction
                                  label={`Mark campaign ${b.subject} as failed`}
                                  message="Mark this campaign failed? Nobody is emailed, and the remainder still needs a new, narrower campaign."
                                  confirmLabel="Mark failed"
                                  danger
                                  idleClassName="inline-flex items-center gap-1.5 rounded-xl bg-amber-200 px-3 py-1.5 text-xs font-black text-amber-950 transition-colors hover:bg-amber-300 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                                  onConfirm={() => void onMarkFailed(b.id)}
                                >
                                  <AlertCircle size={13} aria-hidden="true" />
                                  Mark as failed
                                </ConfirmAction>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/*
       The pager, and it is here rather than "load more" on purpose.

       `getCRMBroadcastHistoryPage` exists and the composer was not using it, so this
       table rendered the first 25 campaigns and stopped — the same unreachable-row
       problem `deleteCRMBroadcastDraft`'s comment describes for drafts, except here
       the rows are read-only so nobody can tell they are missing. A chapter past 25
       campaigns simply could not confirm what it had sent.

       Reusing `CRMPager` is the point: numbered links reach page 6 directly, where
       Next-only would mean five clicks, and it already renders an accessible
       current-page state.
    */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-bold text-muted-foreground">
                Showing{' '}
                <span className="text-foreground font-black">
                  {first}–{last}
                </span>{' '}
                of <span className="text-foreground font-black">{totalCount.toLocaleString()}</span>{' '}
                campaigns
              </p>
              <CRMPager
                page={page}
                totalCount={totalCount}
                pageSize={BROADCAST_HISTORY_PAGE_SIZE}
                basePath="/admin/crm/broadcasts"
                params={params}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
