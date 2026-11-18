'use client';

import { Activity, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import type { BackendStatus, BackendSummary } from '@/types/unified';

export function SystemDiagnosticsDialog({
  open,
  onOpenChange,
  backendStatus,
  backendSummary,
  statusLoading,
  onProbe,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backendStatus: BackendStatus | null;
  backendSummary: BackendSummary | null;
  statusLoading: boolean;
  onProbe: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-surface-card text-foreground p-6 rounded-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Activity className="text-accent-gold" size={18} />
                System &amp; Edge Diagnostics
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Live health verification of Supabase PostgreSQL, S3 Media Storage, and Edge
                Functions.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={onProbe}
              disabled={statusLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-light transition-colors disabled:opacity-50 shadow-xs"
            >
              <RefreshCw size={12} className={statusLoading ? 'animate-spin' : ''} />
              <span>{statusLoading ? 'Probing…' : 'Probe Now'}</span>
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-3 my-4">
          {/* Database */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-muted border border-border">
            <div className="flex items-center gap-2.5">
              <span
                className={`size-2.5 rounded-full ${
                  backendStatus?.database ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
              <div>
                <p className="text-xs font-bold text-foreground">PostgreSQL Database</p>
                <p className="text-[11px] text-muted-foreground">
                  RLS-secured tables (content, CRM, events, gallery)
                </p>
              </div>
            </div>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                backendStatus?.database
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-rose-500/10 text-rose-500'
              }`}
            >
              {backendStatus?.database ? 'Connected' : 'Offline'}
            </span>
          </div>

          {/* S3 Storage */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-muted border border-border">
            <div className="flex items-center gap-2.5">
              <span
                className={`size-2.5 rounded-full ${
                  backendStatus?.storage ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
              <div>
                <p className="text-xs font-bold text-foreground">Supabase S3 Storage</p>
                <p className="text-[11px] text-muted-foreground">
                  Bucket &quot;media&quot; (crm, content, hero, gallery folders)
                </p>
              </div>
            </div>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                backendStatus?.storage
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-rose-500/10 text-rose-500'
              }`}
            >
              {backendStatus?.storage ? 'Ready' : 'Error'}
            </span>
          </div>

          {/* Edge Function */}
          <div className="p-3 rounded-2xl bg-surface-muted border border-border space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className={`size-2.5 rounded-full ${
                    backendStatus?.edgeFunction ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <div>
                  <p className="text-xs font-bold text-foreground">Edge Functions API</p>
                  <p className="text-[11px] font-mono text-muted-foreground truncate max-w-[280px]">
                    {backendStatus?.edgeFunctionDetails?.endpoint || 'functions/v1/health'}
                  </p>
                </div>
              </div>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                  backendStatus?.edgeFunction
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-amber-500/10 text-amber-500'
                }`}
              >
                {backendStatus?.edgeFunction ? 'Healthy' : 'Degraded'}
              </span>
            </div>
            {backendStatus?.edgeFunctionDetails && (
              <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                <span>
                  Latency:{' '}
                  <strong className="text-foreground">
                    {backendStatus.edgeFunctionDetails.latencyMs ?? '—'}ms
                  </strong>
                </span>
                <span>
                  Checked:{' '}
                  {backendStatus.edgeFunctionDetails.checkedAt
                    ? new Date(backendStatus.edgeFunctionDetails.checkedAt).toLocaleTimeString()
                    : 'Recently'}
                </span>
              </div>
            )}
          </div>

          {/* Platform Overview */}
          {backendSummary && (
            <div className="p-3 rounded-2xl bg-surface-muted border border-border">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Platform Summary
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-background border border-border">
                  <span className="text-muted-foreground block text-[10px] font-semibold uppercase">
                    Constituents
                  </span>
                  <span className="text-base font-black text-foreground">
                    {backendSummary.crmTotal ?? '—'}
                  </span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    {backendSummary.segments ?? '—'} segments
                    {backendSummary.segments !== null && backendSummary.segmentsTruncated
                      ? '+'
                      : ''}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-background border border-border">
                  <span className="text-muted-foreground block text-[10px] font-semibold uppercase">
                    Civic content
                  </span>
                  <span className="text-base font-black text-foreground">
                    {backendSummary.events ?? '—'}
                  </span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    {backendSummary.events ?? '—'} events · {backendSummary.gallery ?? '—'} photos
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-border"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
