'use client';

import { Radio } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  AVAILABLE_DISTRICTS,
  AVAILABLE_STATUSES,
} from '@/components/admin/crm/broadcast-options';
import type { CRMSegment } from '@/types/crm';

const TAG_CHIP_CAP = 40;

interface BroadcastAudiencePanelProps {
  segments: CRMSegment[];
  segmentsTruncated: boolean;
  selectedStatuses: string[];
  selectedDistricts: string[];
  selectedTags: string[];
  onStatusesChange: (statuses: string[]) => void;
  onDistrictsChange: (districts: string[]) => void;
  onTagsChange: (tags: string[]) => void;
  onToggleStatus: (status: string) => void;
  onToggleDistrict: (district: string) => void;
  onToggleTag: (tag: string) => void;
  tagChips: string[];
  hiddenTagCount: number;
  tagsMayBeIncomplete: boolean;
  tagsMissingFromChips: string[];
  onSegmentConsentMismatch: (message: string | null) => void;
}

export function BroadcastAudiencePanel({
  segments,
  segmentsTruncated,
  selectedStatuses,
  selectedDistricts,
  selectedTags,
  onStatusesChange,
  onDistrictsChange,
  onTagsChange,
  onToggleStatus,
  onToggleDistrict,
  onToggleTag,
  tagChips,
  hiddenTagCount,
  tagsMayBeIncomplete,
  tagsMissingFromChips,
  onSegmentConsentMismatch,
}: BroadcastAudiencePanelProps) {
  return (
    <div className="lg:col-span-5 space-y-6">
      <div className="bg-surface-card p-6 rounded-2xl border border-border shadow-xs space-y-6">
        <div className="flex items-center gap-2">
          <Radio size={16} className="text-primary dark:text-primary-on-dark" />
          <h2 className="font-display text-xs font-semibold tracking-[-0.01em] text-foreground">
            1. Audience segmentation
          </h2>
        </div>

        {/*
          Saved-segment prefill.

          A segment with a search term cannot be pre-filled here, and this is
          the second half of that: the old `onChange` set the status, district
          and tag chips, ignored `seg.query`, and then announced success
          *specifically when a query existed* — so the toast fired exactly
          when the applied audience was wrong. A segment saved from a directory
          search became a whole-segment blast in the composer, announced as
          applied.

          Now the audience that cannot be represented is named, and the live
          count beside it is the real check: applying a query-only segment
          leaves every chip empty, and an empty chip set against a saved
          search segment is visibly not the same audience.
        */}
        {segments.length > 0 && (
          <div className="space-y-2">
            {segmentsTruncated && (
              <p
                role="status"
                className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5"
              >
                Showing the 500 most recent saved segments — older ones exist but are not listed
                here.
              </p>
            )}
            <label
              htmlFor="segment-prefill"
              className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground"
            >
              Apply Saved Segment
            </label>
            <select
              id="segment-prefill"
              value=""
              onChange={(e) => {
                const seg = segments.find((s) => s.id === e.target.value);
                if (!seg) return;
                onStatusesChange(seg.statuses);
                onDistrictsChange(seg.districts);
                onTagsChange(seg.tags);
                /*
                 * Consent is a directory filter, not a broadcast chip — the
                 * composer has no control for it, because broadcasts only
                 * reach people who agreed. Applying a segment saved from an
                 * "Opted Out" view without saying so produces chips that
                 * resolve to the *opted-in* people: the exact opposite of
                 * the segment, announced with a success toast. `seg.query`
                 * got this warning and a label; `seg.consent` got neither.
                 */
                const inapplicable: string[] = [];
                if (seg.query) inapplicable.push(`text search "${seg.query}"`);
                if (seg.consent && seg.consent !== 'opted_in') {
                  inapplicable.push(
                    seg.consent === 'opted_out'
                      ? 'the "Opted Out of Email" filter (broadcasts only reach people who agreed)'
                      : `the "${seg.consent}" consent filter (broadcasts only reach people who agreed)`
                  );
                  // Persistent rather than toast-only, and Send is withheld
                  // until a chip changes: the chips left behind resolve to
                  // the opted-in subset — the opposite of this segment — and
                  // a transient toast is not where that misunderstanding
                  // should live.
                  onSegmentConsentMismatch(
                    `"${seg.name}" partially applied — it also filters on ${inapplicable.join(' and ')}, which broadcasts cannot target. The audience above is the opted-in subset, not that segment.`
                  );
                } else {
                  onSegmentConsentMismatch(null);
                  if (inapplicable.length > 0) {
                    toast.message(
                      `"${seg.name}" partially applied — it also filters on ${inapplicable.join(' and ')}, which broadcasts cannot target. Check the recipient count before sending.`
                    );
                  } else {
                    toast.message(`Segment "${seg.name}" applied`);
                  }
                }
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:border-primary bg-surface-muted/50"
            >
              <option value="">Choose a saved segment…</option>
              {segments.map((seg) => (
                <option key={seg.id} value={seg.id}>
                  {seg.name}
                  {seg.query || (seg.consent && seg.consent !== 'opted_in')
                    ? ' (partly not applicable here — see note after applying)'
                    : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Engagement Statuses */}
        <div>
          <div className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-2">
            By Engagement Status (Leave empty for all)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {AVAILABLE_STATUSES.map((st) => {
              const isSelected = selectedStatuses.includes(st.id);
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => onToggleStatus(st.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    isSelected
                      ? 'bg-primary text-white'
                      : 'bg-surface-muted text-muted-foreground hover:bg-surface-muted'
                  }`}
                >
                  {st.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Districts */}
        <div>
          <div className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-2">
            By Congressional District (Leave empty for all)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {AVAILABLE_DISTRICTS.map((d) => {
              const isSelected = selectedDistricts.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onToggleDistrict(d.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    isSelected
                      ? 'bg-primary text-white'
                      : 'bg-surface-muted text-muted-foreground hover:bg-surface-muted'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tags */}
        <div>
          <div className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-2">
            By Interest Tags (Must match all selected)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tagChips.map((t) => {
              const isSelected = selectedTags.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onToggleTag(t)}
                  aria-pressed={isSelected}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                    isSelected
                      ? 'bg-primary text-white'
                      : 'bg-surface-muted text-muted-foreground hover:bg-surface-muted'
                  }`}
                >
                  #{t}
                </button>
              );
            })}

            {/* Tags that would otherwise be unreachable. A cap that hides a
                tag means a constituent carrying only that tag cannot be
                targeted, which is a silent hole in the audience rather than a
                cosmetic one. */}
            {hiddenTagCount > 0 && (
              <p className="w-full text-[11px] font-medium text-muted-foreground mt-1">
                {hiddenTagCount} more tag{hiddenTagCount === 1 ? '' : 's'} not shown — this panel
                lists the first {TAG_CHIP_CAP} alphabetically. Target one from the{' '}
                <Link
                  href="/admin/crm"
                  className="text-primary dark:text-primary-on-dark font-bold hover:underline"
                >
                  directory
                </Link>
                .
              </p>
            )}

            {/*
              A stronger claim than the cap above, and it has to be worded differently.

              The cap hides tags that were *read* and remain reachable from the directory. An
              exhausted scan hides tags that were never read: no chip, no suggestion, no
              discovery route. So this does not point at the directory — a tag missing from
              this list may be missing from the directory's filter too, since both read the
              same scan — and it says the list may be incomplete rather than that tags are
              hidden, because the chapter genuinely does not know which ones.
            */}
            {tagsMayBeIncomplete && (
              <p className="w-full text-[11px] font-bold text-accent-red mt-1">
                This chapter’s directory is too large to list every tag, so this list may be
                incomplete. A tag you cannot see here cannot be targeted from here — narrow the
                audience with status or district filters, or search the{' '}
                <Link
                  href="/admin/crm"
                  className="text-primary dark:text-primary-on-dark font-bold hover:underline"
                >
                  directory
                </Link>{' '}
                by name.
              </p>
            )}

            {tagsMissingFromChips.length > 0 && (
              <div className="w-full flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[11px] font-bold text-primary dark:text-primary-on-dark">
                  Also targeting:
                </span>
                {tagsMissingFromChips.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onToggleTag(t)}
                    aria-pressed
                    className="px-2.5 py-1 rounded-md bg-primary text-white text-xs font-bold"
                  >
                    #{t} ×
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Filter Summary */}
        <div className="p-4 bg-surface-muted rounded-xl border border-border text-xs text-muted-foreground space-y-1">
          <div className="font-bold text-foreground">Targeting Rules Applied:</div>
          <div>
            Status: {selectedStatuses.length > 0 ? selectedStatuses.join(', ') : 'All Statuses'}
          </div>
          <div>
            Districts:{' '}
            {selectedDistricts.length > 0 ? selectedDistricts.join(', ') : 'All Districts'}
          </div>
          <div>Tags: {selectedTags.length > 0 ? selectedTags.join(', ') : 'None'}</div>
        </div>
      </div>
    </div>
  );
}
