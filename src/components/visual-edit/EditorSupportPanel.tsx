'use client';

import {
  Activity,
  ExternalLink,
  Keyboard,
  RefreshCw,
  X,
} from 'lucide-react';
import type { VisualEditorSidebarProps } from './VisualEditorSidebar';

export function EditorSupportPanel({ props }: { props: VisualEditorSidebarProps }) {
  const { backendStatus, backendSummary, showHealthDetails, statusLoading, adminEditUrl } = props;

  return (
    <>
    {/* ── Info: shortcuts & health ──────────────────────────────────── */}
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={props.onOpenShortcuts}
          title="Keyboard shortcuts cheat sheet (⌘/)"
          aria-label="Keyboard shortcuts cheat sheet"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-gold"
        >
          <Keyboard size={14} className="text-accent-gold" />
          <span>Shortcuts</span>
        </button>

        <button
          type="button"
          onClick={props.onToggleHealthDetails}
          title="Supabase Backend & Edge Function Health"
          aria-label="Supabase Backend & Edge Function Health"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs font-bold text-ink-muted-on-dark hover:bg-white/10"
        >
          <Activity
            size={13}
            className={
              backendStatus?.database && backendStatus?.storage && backendStatus?.edgeFunction
                ? 'text-emerald-400'
                : 'text-amber-400'
            }
          />
          <span
            className={`size-2 rounded-full ${
              backendStatus?.database && backendStatus?.storage && backendStatus?.edgeFunction
                ? 'bg-emerald-400'
                : !backendStatus?.database || !backendStatus?.storage
                  ? 'bg-rose-400'
                  : 'bg-amber-400'
            }`}
          />
        </button>
      </div>

      {showHealthDetails && backendStatus && (
        <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-xs space-y-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="font-black uppercase tracking-wider text-white">Backend Health</span>
            <button
              type="button"
              onClick={props.onProbeBackendHealth}
              disabled={statusLoading}
              className="p-1 text-slate-400 hover:text-white"
              aria-label="Refresh health probe"
            >
              <RefreshCw size={12} className={statusLoading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="flex items-center justify-between text-ink-on-dark">
            <span>Database (Postgres)</span>
            <span
              className={
                backendStatus.database ? 'font-bold text-emerald-400' : 'font-bold text-rose-400'
              }
            >
              {backendStatus.database ? 'Connected' : 'Offline'}
            </span>
          </div>
          <div className="flex items-center justify-between text-ink-on-dark">
            <span>Supabase S3 Storage</span>
            <span
              className={
                backendStatus.storage ? 'font-bold text-emerald-400' : 'font-bold text-rose-400'
              }
            >
              {backendStatus.storage ? 'media bucket ready' : 'Error'}
            </span>
          </div>
          <div className="flex items-center justify-between text-ink-on-dark">
            <span>Edge Functions</span>
            <span
              className={
                backendStatus.edgeFunction
                  ? 'font-bold text-emerald-400'
                  : 'font-bold text-amber-400'
              }
            >
              {backendStatus.edgeFunction ? 'Healthy' : 'Fallback'}
            </span>
          </div>
          {backendStatus.edgeFunctionDetails?.latencyMs !== undefined && (
            <div className="text-right text-[10px] text-ink-muted-on-dark">
              Latency: {backendStatus.edgeFunctionDetails.latencyMs}ms
            </div>
          )}
          {backendSummary && (
            <div className="space-y-1.5 border-t border-white/10 pt-2">
              <div className="flex items-center justify-between text-ink-on-dark">
                <span>Constituents</span>
                <span className="font-bold">
                  {backendSummary.crmTotal ?? '—'}
                  <span className="font-medium text-ink-muted-on-dark">
                    {' '}
                    · {backendSummary.segments ?? '—'} segments
                    {backendSummary.segments !== null && backendSummary.segmentsTruncated
                      ? '+'
                      : ''}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between text-ink-on-dark">
                <span>Civic content</span>
                <span className="font-bold">
                  {backendSummary.events ?? '—'} events · {backendSummary.gallery ?? '—'} photos
                </span>
              </div>
              <div className="flex items-center justify-between text-ink-on-dark">
                <span>Media library</span>
                <span className="font-bold">
                  {backendSummary.mediaItems ?? '—'} recent files
                  {backendSummary.mediaItems !== null && backendSummary.mediaTruncated ? '+' : ''}
                </span>
              </div>
              {(backendSummary.mediaTruncated ||
                backendSummary.segmentsTruncated ||
                backendSummary.revisionsTruncated) && (
                <p className="text-[10px] text-ink-muted-on-dark">
                  Capped window — open the picker for the full list.
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={props.onOpenDiagnostics}
            className="mt-1 w-full rounded-md bg-white/5 py-1 text-center text-[11px] font-bold text-accent-gold transition-colors hover:bg-white/10 hover:text-white"
          >
            System Diagnostics →
          </button>
        </div>
      )}
    </div>

    {/* ── Admin link ────────────────────────────────────────────────── */}
    {adminEditUrl && (
      <a
        href={adminEditUrl}
        target="_blank"
        rel="noreferrer"
        title="Open full admin page editor in new tab"
        aria-label="Open full admin page editor in new tab"
        className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-muted-on-dark hover:bg-white/10 hover:text-white"
      >
        <span className="flex-1">Admin</span>
        <ExternalLink size={12} />
      </a>
    )}

    {/* ── Exit ──────────────────────────────────────────────────────── */}
    <button
      type="button"
      onClick={props.onToggle}
      className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-accent-gold"
    >
      <X size={14} />
      <span>Done</span>
    </button>

    </>
  );
}
