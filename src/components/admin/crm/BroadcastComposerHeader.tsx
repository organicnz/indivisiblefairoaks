'use client';

import { ArrowLeft, Megaphone, Users } from 'lucide-react';
import Link from 'next/link';
import type { BackendStatus } from '@/types/unified';

interface BroadcastComposerHeaderProps {
  backendStatus?: BackendStatus;
  calculatingCount: boolean;
  countFailed: boolean;
  recipientCount: number | null;
}

export function BroadcastComposerHeader({
  backendStatus,
  calculatingCount,
  countFailed,
  recipientCount,
}: BroadcastComposerHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
      <div>
        <Link
          href="/admin/crm"
          className="inline-flex items-center gap-2 text-xs font-black text-muted-foreground hover:text-primary dark:hover:text-primary-on-dark uppercase tracking-widest transition-colors mb-2"
        >
          <ArrowLeft size={14} /> Back to Constituent Directory
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-xs">
            <Megaphone size={20} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">
              Campaign broadcasts
            </h1>
            <p className="text-xs font-bold text-muted-foreground">
              Segment and dispatch branded chapter email broadcasts via Resend.
            </p>
            {backendStatus && (
              <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-border">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Database: Connected
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    backendStatus.storage
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${backendStatus.storage ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  />
                  Supabase S3 Media: {backendStatus.storage ? 'Online' : 'Degraded'}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    backendStatus.edgeFunction
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${backendStatus.edgeFunction ? 'bg-emerald-500' : 'bg-blue-500'}`}
                  />
                  Edge Function: {backendStatus.edgeFunction ? 'Ready' : 'Direct Mode'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Audience Badge */}
      <div className="bg-slate-900 text-white px-5 py-3 rounded-2xl flex items-center gap-3 border border-slate-800 shadow-sm self-start sm:self-auto">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary-light">
          <Users size={16} />
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Matched Audience
          </div>
          <div className="text-lg font-black text-white">
            {calculatingCount ? (
              <span className="text-muted-foreground text-sm">Calculating...</span>
            ) : countFailed ? (
              <span className="text-accent-red text-sm font-bold">Count unavailable</span>
            ) : (
              <span>{recipientCount ?? 0} constituents</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
