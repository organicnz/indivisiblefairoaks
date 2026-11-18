'use client';

import { Edit2, ExternalLink, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import { CRMPager } from '@/components/admin/crm/CRMPager';
import { type ContactFilters, filterParams, pageRange, totalPages } from '@/lib/crm-filters';
import type { ConsentDecision, CRMContact } from '@/types/crm';

const STATUS_COLORS: Record<string, string> = {
  active_volunteer: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  organizer: 'bg-purple-100 text-purple-800 border-purple-300',
  choir: 'bg-blue-100 text-blue-800 border-blue-300',
  donor: 'bg-amber-100 text-amber-800 border-amber-300',
  supporter: 'bg-surface-muted text-foreground border-border',
  inactive: 'bg-rose-100 text-rose-700 border-rose-300',
};

interface CRMContactTableProps {
  contacts: CRMContact[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  appliedFilters: ContactFilters;
  selectedIds: Set<string>;
  allOnPageSelected: boolean;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: string) => void;
  onEditContact: (contact: CRMContact) => void;
  onDeleteContact: (id: string, name: string) => void;
  updatingConsentId: string | null;
  onConsentChange: (contact: CRMContact, next: ConsentDecision) => void;
  updatingStatusId: string | null;
  onStatusChange: (contact: CRMContact, nextStatus: string) => void;
  addingTagContactId: string | null;
  inlineTagInput: string;
  onInlineTagInputChange: (value: string) => void;
  onStartAddTag: (contactId: string) => void;
  onCancelAddTag: () => void;
  onAddTag: (contact: CRMContact) => void;
  onRemoveTag: (contact: CRMContact, tag: string) => void;
  tagBusyContactId: string | null;
  deletingContactId: string | null;
}

export function CRMContactTable({
  contacts,
  totalCount,
  currentPage,
  pageSize,
  appliedFilters,
  selectedIds,
  allOnPageSelected,
  onToggleSelectAll,
  onToggleSelect,
  onEditContact,
  onDeleteContact,
  updatingConsentId,
  onConsentChange,
  updatingStatusId,
  onStatusChange,
  addingTagContactId,
  inlineTagInput,
  onInlineTagInputChange,
  onStartAddTag,
  onCancelAddTag,
  onAddTag,
  onRemoveTag,
  tagBusyContactId,
  deletingContactId,
}: CRMContactTableProps) {
  const totalRows = totalPages(totalCount, pageSize);
  const [firstRow, lastRow] = pageRange(currentPage, pageSize, totalCount);

  return (
    <div className="bg-surface-card rounded-2xl border border-border shadow-xs overflow-hidden">
      {/*
        `tabIndex={0}` on the scroll container, per the WAI-ARIA Scrollable
        Region pattern. Chrome and Firefox stopped focusing an `overflow-x-auto`
        element by default, so without it a keyboard user cannot scroll the
        table sideways at all — and this table has seven columns. `role="region"`
        with a name is what gives that focus a purpose; a bare `tabIndex` on a
        non-interactive element is a focus trap with nothing to do. The repo
        already does this in `ContentList.tsx` and `BlockEditor.tsx`.
      */}
      {/*
        A `<section>`, not a `<div role="region">` — same role, no ARIA to
        keep in sync, and it is what `ContentList.tsx` and `BlockEditor.tsx`
        already use for this pattern. The accessible name is the caption below,
        so the region is "Constituent directory, page N" to a screen reader and
        has a heading-like boundary in the document outline.
      */}
      <section
        className="overflow-x-auto"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: WAI-ARIA scrollable region, see AGENTS.md "Scrollable regions must be focusable"
        tabIndex={0}
        // Named, not implied by the caption below: a `<caption>` names the
        // *table*, and this `<section>` is the scroll container wrapping it. A
        // scroll region needs its own name for a screen reader to announce
        // "region, Constituent directory, scrollable" when focus lands here.
        aria-label="Constituent directory, scrollable"
      >
        <table className="w-full text-left border-collapse">
          {/*
            A caption, because a seven-column table with no caption is announced
            as an unlabelled grid. Visually hidden rather than visible: the
            panel heading already names the table, and a visible caption would
            say it twice.
          */}
          <caption className="sr-only">
            Constituents matching the current filters, page {currentPage}
          </caption>
          <thead>
            <tr className="bg-surface-muted/80 border-b border-border text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              <th scope="col" className="py-3.5 px-4 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={onToggleSelectAll}
                  aria-label="Select all constituents on this page"
                  className="rounded border-border text-primary dark:text-primary-on-dark focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                />
              </th>
              <th scope="col" className="py-3.5 px-4">
                Constituent
              </th>
              <th scope="col" className="py-3.5 px-4">
                District / City
              </th>
              <th scope="col" className="py-3.5 px-4">
                Status
              </th>
              <th scope="col" className="py-3.5 px-4">
                Tags &amp; Roles
              </th>
              <th scope="col" className="py-3.5 px-4">
                Contributions
              </th>
              <th scope="col" className="py-3.5 px-4">
                Last Active
              </th>
              <th scope="col" className="py-3.5 px-4 text-right">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-muted-foreground">
                  <Users size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="font-bold">No constituents matched your search criteria.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try clearing filters or click &ldquo;Sync History&rdquo; to pull from form
                    submissions.
                  </p>
                </td>
              </tr>
            ) : (
              contacts.map((contact) => {
                const fullName =
                  [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
                  contact.email.split('@')[0];
                const statusClass = STATUS_COLORS[contact.status] || STATUS_COLORS.supporter;

                return (
                  <tr
                    key={contact.id}
                    className={`hover:bg-surface-muted/80 transition-colors group ${
                      selectedIds.has(contact.id) ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(contact.id)}
                        onChange={() => onToggleSelect(contact.id)}
                        aria-label={`Select ${fullName}`}
                        className="rounded border-border text-primary dark:text-primary-on-dark focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                      />
                    </td>
                    {/* Name & Email */}
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/admin/crm/${contact.id}`}
                        className="font-bold text-foreground hover:text-primary dark:hover:text-primary-on-dark transition-colors flex items-center gap-1.5"
                      >
                        {fullName}
                        <ExternalLink
                          size={11}
                          className="opacity-0 group-hover:opacity-60 transition-opacity"
                        />
                      </Link>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <span className="truncate">{contact.email}</span>
                        <select
                          value={
                            contact.do_not_email === true
                              ? 'opted_out'
                              : contact.do_not_email === false
                                ? 'opted_in'
                                : 'unasked'
                          }
                          disabled={updatingConsentId === contact.id}
                          onChange={(e) =>
                            onConsentChange(contact, e.target.value as ConsentDecision)
                          }
                          className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-black uppercase leading-none border cursor-pointer ${
                            contact.do_not_email === true
                              ? 'bg-red-50 text-red-600 border-red-200'
                              : contact.do_not_email === false
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                          } ${updatingConsentId === contact.id ? 'opacity-50' : ''}`}
                          title="Quick change email consent"
                          aria-label={`Email consent for ${fullName}`}
                        >
                          <option value="opted_in">opted-in</option>
                          <option value="opted_out">opt-out</option>
                          <option value="unasked">unasked</option>
                        </select>
                      </div>
                      {contact.phone && (
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {contact.phone}
                        </div>
                      )}
                    </td>

                    {/* District & City */}
                    <td className="py-3.5 px-4">
                      <span className="inline-block font-mono font-bold text-[11px] px-2 py-0.5 rounded-md bg-surface-muted text-foreground">
                        {contact.district || 'CA-06'}
                      </span>
                      {contact.city && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {contact.city}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <div className="relative inline-block">
                        <select
                          value={contact.status}
                          disabled={updatingStatusId === contact.id}
                          onChange={(e) => onStatusChange(contact, e.target.value)}
                          className={`cursor-pointer appearance-none rounded-sm border px-2.5 py-0.5 pr-5 text-[10px] font-black uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${statusClass} ${
                            updatingStatusId === contact.id ? 'opacity-50' : ''
                          }`}
                          title="Click to quick change status"
                          aria-label={`Status for ${fullName}`}
                        >
                          <option value="active_volunteer">Active Volunteer</option>
                          <option value="organizer">Organizer</option>
                          <option value="choir">Resistance Choir</option>
                          <option value="donor">Donor</option>
                          <option value="supporter">Supporter</option>
                          <option value="inactive">Inactive</option>
                        </select>
                        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] opacity-60">
                          ▼
                        </span>
                      </div>
                    </td>

                    {/* Tags */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap items-center gap-1 max-w-[240px]">
                        {contact.tags.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-medium group/tag"
                          >
                            <span>#{t}</span>
                            <button
                              type="button"
                              disabled={tagBusyContactId === contact.id}
                              onClick={() => onRemoveTag(contact, t)}
                              className="opacity-0 group-hover/tag:opacity-100 hover:text-red-600 ml-0.5 text-[11px] leading-none"
                              title={`Remove #${t}`}
                              aria-label={`Remove tag ${t} from ${fullName}`}
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                        {addingTagContactId === contact.id ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              onAddTag(contact);
                            }}
                            className="inline-flex items-center"
                          >
                            <input
                              type="text"
                              autoFocus
                              value={inlineTagInput}
                              onChange={(e) => onInlineTagInputChange(e.target.value)}
                              onBlur={() => {
                                if (!inlineTagInput.trim()) onCancelAddTag();
                              }}
                              placeholder="tag-name"
                              className="w-16 px-1.5 py-0.5 rounded border border-primary text-[10px] font-mono focus:outline-none"
                            />
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onStartAddTag(contact.id)}
                            className="px-1.5 py-0.5 rounded bg-surface-muted hover:bg-surface-muted text-muted-foreground hover:text-foreground text-[10px] font-bold"
                            title="Add tag"
                            aria-label={`Add tag to ${fullName}`}
                          >
                            +
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Contributions */}
                    <td className="py-3.5 px-4 font-mono">
                      {contact.total_donated_cents > 0 ? (
                        <span className="text-emerald-600 font-bold">
                          ${(contact.total_donated_cents / 100).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">$0.00</span>
                      )}
                    </td>

                    {/* Last Active */}
                    <td className="py-3.5 px-4 text-muted-foreground text-[11px]">
                      {contact.last_contacted_at
                        ? new Date(contact.last_contacted_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : new Date(contact.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                    </td>

                    {/* Action Links */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onEditContact(contact)}
                          className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-surface-muted transition-colors"
                          aria-label={`Edit ${fullName}`}
                          title="Edit Contact"
                        >
                          <Edit2 size={13} aria-hidden="true" />
                        </button>
                        <ConfirmAction
                          label={`Delete ${fullName}`}
                          message={`Delete constituent "${fullName}" (${contact.email})?`}
                          danger
                          busy={deletingContactId === contact.id}
                          idleClassName="p-1.5 text-muted-foreground hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                          onConfirm={() => onDeleteContact(contact.id, fullName)}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </ConfirmAction>
                        <Link
                          href={`/admin/crm/${contact.id}`}
                          className="px-2.5 py-1 bg-surface-muted hover:bg-primary hover:text-white rounded-lg text-[11px] font-bold text-muted-foreground transition-colors"
                        >
                          View 360
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      <div className="px-6 pb-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        {/*
          The count lives here, at the bottom, beside the pager — not in the
          action header above the table.
        */}
        <p className="text-xs font-bold text-muted-foreground">
          {totalCount === 0 ? (
            'No constituents'
          ) : (
            <>
              Showing{' '}
              <span className="text-foreground font-black">
                {firstRow}–{lastRow}
              </span>{' '}
              of <span className="text-foreground font-black">{totalCount}</span> constituents
              {totalRows > 1 && (
                <span className="text-muted-foreground">
                  {' '}
                  · page {currentPage} of {totalRows}
                </span>
              )}
            </>
          )}
        </p>
        <CRMPager
          page={currentPage}
          totalCount={totalCount}
          pageSize={pageSize}
          basePath="/admin/crm"
          // The *applied* filters, not the draft — paging off unsaved form
          // state jumped to a different result set whenever a filter had been
          // typed but not submitted. `filterParams` also keeps `consent` in
          // the link, which is the filter most worth preserving across pages.
          params={filterParams(appliedFilters)}
        />
      </div>
    </div>
  );
}
