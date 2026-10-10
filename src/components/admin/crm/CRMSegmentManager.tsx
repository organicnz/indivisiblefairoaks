'use client';

import { Layers, Trash2, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ConfirmAction } from '@/components/admin/ConfirmAction';
import {
  deleteCRMSegment,
  getBroadcastRecipientCount,
  getCRMExistingTags,
  saveCRMSegment,
} from '@/lib/actions/crm';
import type { CRMSegment } from '@/types/crm';

/**
 * Saved audience segments — the CRM's missing list view.
 *
 * `saveCRMSegment` and `deleteCRMSegment` existed for a long time with no
 * surface that could *edit* one: the only way to reach a segment was the chip
 * the directory saved from the filter bar, and the only way to change it was to
 * save a new one over its name. A chapter that saved "Choir roster — agreed" in
 * March and wanted to drop a district from it had no way to.
 *
 * This page is the whole CRUD surface over those same actions — no new mutation
 * is introduced, so the actions the directory already calls stay the ones that
 * write. **The audience count is derived from the segment's own rules** rather
 * than stored: a segment's filters are the specification, and a cached number
 * would be a claim about who would be mailed that goes stale the moment a
 * contact is imported.
 */

type SegmentForm = {
  name: string;
  query: string;
  statuses: string;
  districts: string;
  tags: string;
  consent: '' | 'opted_out' | 'opted_in' | 'unasked';
};

const EMPTY_FORM: SegmentForm = {
  name: '',
  query: '',
  statuses: '',
  districts: '',
  tags: '',
  consent: '',
};

function toForm(segment: CRMSegment): SegmentForm {
  return {
    name: segment.name,
    query: segment.query,
    statuses: segment.statuses.join(', '),
    districts: segment.districts.join(', '),
    tags: segment.tags.join(', '),
    consent: (segment.consent ?? '') as SegmentForm['consent'],
  };
}

/** A comma-separated field back to the array the action expects. */
function toList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function describeSegment(segment: CRMSegment): string[] {
  const parts: string[] = [];
  if (segment.statuses.length > 0) parts.push(`Status: ${segment.statuses.join(', ')}`);
  if (segment.districts.length > 0) parts.push(`District: ${segment.districts.join(', ')}`);
  if (segment.tags.length > 0) parts.push(`Tags: ${segment.tags.join(', ')}`);
  if (segment.consent) parts.push(`Consent: ${segment.consent.replace('_', ' ')}`);
  if (!parts.length) parts.push('Every contact');
  return parts;
}

export function CRMSegmentManager({
  initialSegments,
  truncated,
}: {
  initialSegments: CRMSegment[];
  truncated: boolean;
}) {
  const router = useRouter();
  // No local copy of the list. Every write ends in `router.refresh()`, which
  // re-renders the server page and hands down a fresh `initialSegments`; a
  // second copy here would keep showing the pre-save list until a hard reload.
  const segments = initialSegments;
  const [form, setForm] = useState<SegmentForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, { count: number; excluded: number }>>({});

  useEffect(() => {
    let cancelled = false;
    getCRMExistingTags()
      .then((scan) => {
        // The scan is the object; only its `tags` list is a suggestion source
        // here. `truncated` means the list may be incomplete, which is a reason
        // to keep the field free-text — it already is.
        if (!cancelled) setKnownTags(scan?.tags ?? []);
      })
      .catch(() => {
        // A tag list that cannot be read leaves the free-text field usable; the
        // suggestions are a convenience, not the input.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadCount = useCallback(async (segment: CRMSegment) => {
    try {
      const res = await getBroadcastRecipientCount({
        targetStatus: segment.statuses,
        targetDistricts: segment.districts,
        targetTags: segment.tags,
      });
      setCounts((prev) => ({
        ...prev,
        [segment.id]: { count: res.count, excluded: res.excludedCount },
      }));
    } catch {
      // A segment whose audience cannot be counted is still listed — one
      // unreadable count must not empty the page.
    }
  }, []);

  useEffect(() => {
    for (const segment of segments) loadCount(segment);
  }, [segments, loadCount]);

  const startEdit = (segment: CRMSegment) => {
    setEditingId(segment.id);
    setForm(toForm(segment));
  };

  const reset = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await saveCRMSegment({
        id: editingId ?? undefined,
        name: form.name,
        query: form.query,
        statuses: toList(form.statuses),
        districts: toList(form.districts),
        tags: toList(form.tags),
        consent: form.consent || undefined,
      });
      if (res.success) {
        reset();
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteCRMSegment(id);
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-primary" aria-hidden="true" />
          <h2 className="text-lg font-black uppercase tracking-tight text-secondary">
            Saved segments
          </h2>
          <span className="text-xs text-slate-500">{segments.length} total</span>
        </div>

        {truncated && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Only the most recent segments are shown. The chapter has more than this page can list.
          </p>
        )}

        {segments.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            No segments saved yet. Filter the directory and choose “Save as segment” to create your
            first reusable audience.
          </p>
        ) : (
          <ul className="space-y-2">
            {segments.map((segment) => {
              const count = counts[segment.id];
              return (
                <li
                  key={segment.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-secondary">{segment.name}</h3>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {describeSegment(segment).join(' · ')}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Saved {new Date(segment.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                        <Users size={12} aria-hidden="true" />
                        {count ? `${count.count} reachable` : '…'}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEdit(segment)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-secondary hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <ConfirmAction
                        label={`Delete ${segment.name}`}
                        message={`Delete the segment "${segment.name}"? This changes who a broadcast reaches only if it is used as an audience; the contacts themselves are untouched.`}
                        confirmLabel="Delete"
                        danger
                        busy={deletingId === segment.id}
                        idleClassName="rounded-lg border border-rose-200 p-1.5 text-accent-red hover:bg-rose-50"
                        onConfirm={() => remove(segment.id)}
                      >
                        <Trash2 size={13} />
                      </ConfirmAction>
                    </div>
                  </div>
                  {count && count.excluded > 0 && (
                    <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
                      {count.excluded} matching contact{count.excluded === 1 ? '' : 's'} excluded
                      from delivery — never asked or opted out.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form
        className="space-y-3 self-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <h3 className="text-sm font-black uppercase tracking-wider text-secondary">
          {editingId ? 'Edit segment' : 'New segment'}
        </h3>

        <label className="block text-xs font-bold text-slate-600" htmlFor="segment-name">
          Name
          <input
            id="segment-name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            maxLength={60}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-secondary focus:ring-2 focus:ring-primary"
            placeholder="Choir roster — agreed"
          />
        </label>

        <label className="block text-xs font-bold text-slate-600" htmlFor="segment-statuses">
          Statuses <span className="font-medium normal-case text-slate-400">comma separated</span>
          <input
            id="segment-statuses"
            value={form.statuses}
            onChange={(event) => setForm((prev) => ({ ...prev, statuses: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-secondary focus:ring-2 focus:ring-primary"
            placeholder="active, volunteer"
          />
        </label>

        <label className="block text-xs font-bold text-slate-600" htmlFor="segment-districts">
          Districts
          <input
            id="segment-districts"
            value={form.districts}
            onChange={(event) => setForm((prev) => ({ ...prev, districts: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-secondary focus:ring-2 focus:ring-primary"
            placeholder="CA-06"
          />
        </label>

        <label className="block text-xs font-bold text-slate-600" htmlFor="segment-tags">
          Tags{' '}
          {knownTags.length > 0 && (
            <span className="font-medium normal-case text-slate-400">
              e.g. {knownTags.slice(0, 3).join(', ')}
            </span>
          )}
          <input
            id="segment-tags"
            value={form.tags}
            onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-secondary focus:ring-2 focus:ring-primary"
            placeholder="choir"
          />
        </label>

        <label className="block text-xs font-bold text-slate-600" htmlFor="segment-consent">
          Consent
          <select
            id="segment-consent"
            value={form.consent}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                consent: event.target.value as SegmentForm['consent'],
              }))
            }
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-secondary focus:ring-2 focus:ring-primary"
          >
            <option value="">Any / no filter</option>
            <option value="opted_in">Opted in</option>
            <option value="unasked">Never asked</option>
            <option value="opted_out">Opted out</option>
          </select>
        </label>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={saving || !form.name.trim()}
            className="rounded-full bg-secondary px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-primary disabled:opacity-50"
          >
            {editingId ? 'Save changes' : 'Create segment'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={reset}
              className="text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-secondary"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
