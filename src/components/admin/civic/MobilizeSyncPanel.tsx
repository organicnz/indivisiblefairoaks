'use client';

import {
  AlertTriangle,
  CalendarPlus,
  ExternalLink,
  Loader2,
  Pin,
  Play,
  RefreshCw,
  Save,
  ShieldOff,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  getMobilizeSettings,
  getMobilizeSyncRuns,
  importMobilizeEvent,
  type MobilizePreview,
  type MobilizePreviewRow,
  type MobilizeSettingsRecord,
  type MobilizeSyncRun,
  previewMobilizeSource,
  runMobilizeSyncNow,
  saveMobilizeSettings,
  setMobilizeRule,
} from '@/lib/actions/mobilize';

/**
 * `/admin/events → Mobilize` (issue #153).
 *
 * This is the screen the scoping question was meant to be answered from: it
 * lists every event the current filters admit *and* every one they reject, with
 * the reason. The filtering runs through the same shared function the scheduled
 * Edge Function uses, so what an organizer approves here is what the sync
 * imports.
 */
export function MobilizeSyncPanel() {
  const [saved, setSaved] = useState<MobilizeSettingsRecord | null>(null);
  const [draft, setDraft] = useState<MobilizeSettingsRecord | null>(null);
  const [preview, setPreview] = useState<MobilizePreview | null>(null);
  const [runs, setRuns] = useState<MobilizeSyncRun[]>([]);
  const [feedUrl, setFeedUrl] = useState('');
  const [singleEventUrl, setSingleEventUrl] = useState('');
  const [localityText, setLocalityText] = useState('');

  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);
  const [importingSingle, setImportingSingle] = useState(false);
  const [ruleBusyId, setRuleBusyId] = useState<number | null>(null);

  const applySettings = useCallback((record: MobilizeSettingsRecord) => {
    setSaved(record);
    setDraft(record);
    setLocalityText(record.locality_allowlist.join(', '));
  }, []);

  const refreshPreview = useCallback(
    async (overrides?: {
      feedUrl?: string;
      zipcode?: string;
      maxDist?: number;
      includeVirtual?: boolean;
      highPriorityOnly?: boolean;
    }) => {
      setPreviewing(true);
      try {
        const options = {
          feedUrl: (overrides?.feedUrl ?? feedUrl).trim() || undefined,
          zipcode: overrides?.zipcode ?? draft?.zipcode,
          maxDist: overrides?.maxDist ?? draft?.max_dist,
          includeVirtual: overrides?.includeVirtual ?? draft?.include_virtual,
          highPriorityOnly: overrides?.highPriorityOnly ?? draft?.high_priority_only,
        };
        const result = await previewMobilizeSource(options);
        if (result.success) {
          setPreview(result.data);
        } else {
          toast.error(result.error);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Preview failed');
      } finally {
        setPreviewing(false);
      }
    },
    [draft, feedUrl]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [settingsResult, runsResult] = await Promise.all([
          getMobilizeSettings(),
          getMobilizeSyncRuns(10),
        ]);
        if (cancelled) return;
        if (!settingsResult.success) {
          toast.error(settingsResult.error);
          return;
        }
        if (runsResult.success) setRuns(runsResult.data);
        applySettings(settingsResult.data);

        // The first preview is awaited here rather than in a second effect:
        // an effect watching `draft` would fire again on every keystroke, and
        // one with an intentionally empty dependency list is a stale closure
        // waiting to happen.
        setPreviewing(true);
        const previewResult = await previewMobilizeSource({
          zipcode: settingsResult.data.zipcode,
          maxDist: settingsResult.data.max_dist,
          includeVirtual: settingsResult.data.include_virtual,
          highPriorityOnly: settingsResult.data.high_priority_only,
        });
        if (cancelled) return;
        if (previewResult.success) setPreview(previewResult.data);
        else toast.error(previewResult.error);
      } finally {
        if (!cancelled) {
          setPreviewing(false);
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [applySettings]);

  const rows = preview?.rows ?? [];
  const included = useMemo(() => rows.filter((row) => row.include && !row.alreadyImported), [rows]);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const payload = {
        ...draft,
        locality_allowlist: localityText
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean),
      };
      const result = await saveMobilizeSettings(payload);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      applySettings(result.data);
      toast.success('Mobilize scope saved');
      // Every filter is passed explicitly: `refreshPreview` closes over the
      // pre-save `draft`, so omitting one would preview the old value.
      await refreshPreview({
        zipcode: result.data.zipcode,
        maxDist: result.data.max_dist,
        includeVirtual: result.data.include_virtual,
        highPriorityOnly: result.data.high_priority_only,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const result = await runMobilizeSyncNow();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const body = result.data;
      if (body.skipped) {
        toast.message(`Sync skipped: ${String(body.skipped)}`);
      } else {
        toast.success(
          `Sync complete — ${body.imported ?? 0} imported, ${body.updated ?? 0} updated, ${body.hidden ?? 0} hidden`
        );
      }
      const runsResult = await getMobilizeSyncRuns(10);
      if (runsResult.success) setRuns(runsResult.data);
      await refreshPreview();
    } finally {
      setSyncing(false);
    }
  };

  const handleImport = async (row: MobilizePreviewRow) => {
    setImportingId(row.id);
    try {
      const result = await importMobilizeEvent(String(row.id));
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.converted
          ? `Linked the existing card “${result.data.title}” to Mobilize`
          : `Added “${result.data.title}” to the calendar`
      );
      if (result.data.warnings.length > 0) toast.message(result.data.warnings[0]);
      await refreshPreview();
    } finally {
      setImportingId(null);
    }
  };

  const handleDirectImport = async () => {
    const url = singleEventUrl.trim();
    if (!url) return;
    setImportingSingle(true);
    try {
      const result = await importMobilizeEvent(url);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.converted
          ? `Linked existing card “${result.data.title}” to Mobilize`
          : `Added “${result.data.title}” to the calendar`
      );
      if (result.data.warnings.length > 0) toast.message(result.data.warnings[0]);
      setSingleEventUrl('');
      await refreshPreview();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportingSingle(false);
    }
  };

  const handleRule = async (row: MobilizePreviewRow, action: 'pin' | 'exclude' | null) => {
    setRuleBusyId(row.id);
    try {
      const result = await setMobilizeRule(String(row.id), action);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(action === null ? 'Rule cleared' : action === 'pin' ? 'Pinned' : 'Excluded');
      await refreshPreview();
    } finally {
      setRuleBusyId(null);
    }
  };

  const reasonLabel = (row: MobilizePreviewRow): string => {
    switch (row.reason) {
      case 'rule:pin':
        return 'Pinned';
      case 'rule:exclude':
        return 'Excluded';
      case 'virtual-disabled':
        return 'Virtual — off';
      case 'outside-state':
        return 'Outside CA';
      case 'outside-locality':
        return 'Outside the city list';
      case 'not-high-priority':
        return 'Not high priority';
      default:
        return 'In scope';
    }
  };

  if (loading || !draft) {
    return (
      <div className="flex items-center gap-2 p-8 text-xs font-semibold text-muted-foreground">
        <Loader2 size={16} className="animate-spin" />
        Loading Mobilize settings…
      </div>
    );
  }

  const dirty =
    saved !== null &&
    (draft.enabled !== saved.enabled ||
      draft.org_id !== saved.org_id ||
      draft.zipcode !== saved.zipcode ||
      draft.max_dist !== saved.max_dist ||
      draft.include_virtual !== saved.include_virtual ||
      draft.high_priority_only !== saved.high_priority_only ||
      draft.auto_publish !== saved.auto_publish ||
      localityText !== saved.locality_allowlist.join(', '));

  return (
    <div className="space-y-6">
      {preview?.warning ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{preview.warning}</span>
        </div>
      ) : null}

      {/* ── Scope ─────────────────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-2xl border border-border bg-surface-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-foreground">Scope</h2>
            <p className="text-[11px] text-muted-foreground">
              Events owned by the Indivisible account, filtered to this radius and the city list,
              then narrowed by any per-event rule.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
                className="size-3.5 accent-[var(--color-primary-bright,#2563eb)]"
              />
              Sync enabled
            </label>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-bright px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-opacity disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save scope
            </button>
            <button
              type="button"
              onClick={handleSyncNow}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Sync now
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Org id
            <input
              type="number"
              min={1}
              value={draft.org_id}
              onChange={(event) => setDraft({ ...draft, org_id: Number(event.target.value) || 0 })}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
            />
          </label>
          <label className="space-y-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            ZIP
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={draft.zipcode}
              onChange={(event) =>
                setDraft({ ...draft, zipcode: event.target.value.replace(/\D/g, '').slice(0, 5) })
              }
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
            />
          </label>
          <label className="space-y-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Radius (mi)
            <input
              type="number"
              min={1}
              max={100}
              value={draft.max_dist}
              onChange={(event) =>
                setDraft({ ...draft, max_dist: Number(event.target.value) || 1 })
              }
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
            />
          </label>
          <div className="space-y-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Include
            <div className="flex flex-col gap-1 normal-case tracking-normal">
              <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={draft.include_virtual}
                  onChange={(event) =>
                    setDraft({ ...draft, include_virtual: event.target.checked })
                  }
                  className="size-3.5"
                />
                Virtual events (CA only)
              </label>
              <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={draft.high_priority_only}
                  onChange={(event) =>
                    setDraft({ ...draft, high_priority_only: event.target.checked })
                  }
                  className="size-3.5"
                />
                High priority only
              </label>
              <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={draft.auto_publish}
                  onChange={(event) => setDraft({ ...draft, auto_publish: event.target.checked })}
                  className="size-3.5"
                />
                Publish new events automatically
              </label>
            </div>
          </div>
        </div>

        <label className="block space-y-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Cities (comma separated)
          <input
            type="text"
            value={localityText}
            onChange={(event) => setLocalityText(event.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold normal-case tracking-normal text-foreground"
          />
        </label>

        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border bg-surface-muted/40 p-3">
          <label className="min-w-[240px] flex-1 space-y-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Preview a Mobilize feed link
            <input
              type="url"
              value={feedUrl}
              onChange={(event) => setFeedUrl(event.target.value)}
              placeholder="https://www.mobilize.us/indivisible/?zipcode=95608&max_dist=25"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-normal normal-case tracking-normal text-foreground"
            />
          </label>
          <button
            type="button"
            onClick={() => void refreshPreview()}
            disabled={previewing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {previewing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Preview
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border bg-surface-muted/40 p-3">
          <label className="min-w-[240px] flex-1 space-y-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Directly import any single Mobilize event link (issue #153)
            <input
              type="url"
              value={singleEventUrl}
              onChange={(event) => setSingleEventUrl(event.target.value)}
              placeholder="https://www.mobilize.us/nokings/event/1074514/?followup_modal_context=..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-normal normal-case tracking-normal text-foreground"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleDirectImport()}
            disabled={importingSingle || !singleEventUrl.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent-gold px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-ink-strong transition-colors hover:brightness-110 disabled:opacity-50 cursor-pointer"
          >
            {importingSingle ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <CalendarPlus size={13} />
            )}
            Import Event
          </button>
        </div>
      </section>

      {/* ── Preview ───────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
            What would be imported
          </h2>
          <p className="text-[11px] font-semibold text-muted-foreground" role="status">
            {included.length} to add · {preview?.filteredOut ?? 0} filtered out ·{' '}
            {preview?.inPersonTogether ?? 0} in person
            {(preview?.virtualTogether ?? 0) > 0
              ? ` · ${preview?.virtualTogether ?? 0} virtual`
              : ''}
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface-card p-6 text-xs text-muted-foreground">
            No events returned by that source right now.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className={`flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                  row.include
                    ? 'border-border bg-surface-card'
                    : 'border-dashed border-border bg-surface-muted/40'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                      {(row.eventType || 'Event').replace(/_/g, ' ')}
                    </span>
                    {row.isVirtual ? (
                      <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                        Virtual
                      </span>
                    ) : null}
                    {row.highPriority ? (
                      <span className="rounded-full bg-accent-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                        High priority
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        row.include
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-500/10 text-muted-foreground'
                      }`}
                    >
                      {reasonLabel(row)}
                    </span>
                    {row.alreadyImported ? (
                      <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Imported
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-sm font-bold text-foreground">{row.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.place} · {row.when}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <a
                    href={row.browserUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    Mobilize
                    <ExternalLink size={11} aria-hidden="true" />
                  </a>
                  {row.reason === 'rule:pin' ? (
                    <button
                      type="button"
                      onClick={() => void handleRule(row, null)}
                      disabled={ruleBusyId === row.id}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      Unpin
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleRule(row, 'pin')}
                      disabled={ruleBusyId === row.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      <Pin size={11} />
                      Pin
                    </button>
                  )}
                  {row.reason === 'rule:exclude' ? (
                    <button
                      type="button"
                      onClick={() => void handleRule(row, null)}
                      disabled={ruleBusyId === row.id}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      Allow
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleRule(row, 'exclude')}
                      disabled={ruleBusyId === row.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-rose-600 disabled:opacity-50"
                    >
                      <ShieldOff size={11} />
                      Exclude
                    </button>
                  )}
                  {!row.alreadyImported ? (
                    <button
                      type="button"
                      onClick={() => void handleImport(row)}
                      disabled={importingId === row.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-accent-gold px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-ink-strong disabled:opacity-50"
                    >
                      {importingId === row.id ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <CalendarPlus size={11} />
                      )}
                      Add
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Runs ──────────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-sm font-black uppercase tracking-wider text-foreground">Recent runs</h2>
        {runs.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface-card p-4 text-xs text-muted-foreground">
            No runs recorded yet. The scheduled job runs every 30 minutes once
            <code className="mx-1 rounded bg-muted px-1 py-0.5">
              scripts/seed-mobilize-cron.mjs
            </code>
            has stored the credential.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface-card">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-surface-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-bold">Started</th>
                  <th className="px-3 py-2 font-bold">Checked</th>
                  <th className="px-3 py-2 font-bold">Added</th>
                  <th className="px-3 py-2 font-bold">Updated</th>
                  <th className="px-3 py-2 font-bold">Hidden</th>
                  <th className="px-3 py-2 font-bold">Filtered</th>
                  <th className="px-3 py-2 font-bold">Error</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-3 py-2 font-mono">
                      {new Date(run.started_at).toLocaleString('en-US')}
                    </td>
                    <td className="px-3 py-2">{run.checked}</td>
                    <td className="px-3 py-2">{run.imported}</td>
                    <td className="px-3 py-2">{run.updated}</td>
                    <td className="px-3 py-2">{run.hidden}</td>
                    <td className="px-3 py-2">{run.filtered}</td>
                    <td
                      className="max-w-[280px] truncate px-3 py-2 text-rose-600"
                      title={run.error ?? ''}
                    >
                      {run.error ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
