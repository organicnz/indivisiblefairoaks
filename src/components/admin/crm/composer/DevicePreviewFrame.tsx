'use client';

import { Laptop, Loader2, Smartphone } from 'lucide-react';
import { useState } from 'react';

interface Props {
  previewHtml: string;
  previewLoading: boolean;
  previewFailed?: boolean;
  subject: string;
}

export function DevicePreviewFrame({
  previewHtml,
  previewLoading,
  previewFailed = false,
  subject,
}: Props) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');

  return (
    <div className="space-y-3">
      {/* Viewport switch toolbar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200">
          <button
            type="button"
            onClick={() => setDevice('desktop')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              device === 'desktop'
                ? 'bg-white text-secondary shadow-xs'
                : 'text-slate-600 hover:text-secondary'
            }`}
          >
            <Laptop size={14} />
            Desktop View
          </button>
          <button
            type="button"
            onClick={() => setDevice('mobile')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              device === 'mobile'
                ? 'bg-white text-secondary shadow-xs'
                : 'text-slate-600 hover:text-secondary'
            }`}
          >
            <Smartphone size={14} />
            Mobile View (375px)
          </button>
        </div>

        <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">
          {device === 'desktop' ? 'Full Width Email Client' : 'Smartphone Inbox Preview'}
        </span>
      </div>

      {/* Frame Container */}
      {previewLoading && !previewHtml ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
          <Loader2 className="animate-spin mr-2 text-primary" size={18} />
          Building preview…
        </div>
      ) : previewFailed ? (
        <div
          role="alert"
          className="flex h-40 items-center justify-center rounded-2xl border border-accent-red bg-rose-50 text-sm font-medium text-accent-red"
        >
          The preview could not be built — check the connection and try again.
        </div>
      ) : previewHtml ? (
        device === 'desktop' ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-900 p-2 sm:p-4 shadow-sm overflow-hidden">
            <div className="mb-2 px-2 text-xs font-bold text-slate-400 flex items-center justify-between">
              <span className="truncate max-w-md">Subject: {subject || '(No subject)'}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                Preview Shell
              </span>
            </div>
            <iframe
              title="Broadcast desktop preview"
              srcDoc={previewHtml}
              className="w-full h-[520px] rounded-xl border border-slate-800 bg-white"
              sandbox=""
            />
          </div>
        ) : (
          <div className="flex justify-center py-2 bg-slate-100 rounded-2xl border border-slate-200 p-4">
            {/* Realistic iPhone mockup frame */}
            <div className="w-[375px] h-[640px] rounded-[44px] bg-slate-950 p-3 shadow-2xl border-4 border-slate-800 relative flex flex-col">
              {/* Top speaker notch */}
              <div className="w-28 h-4 bg-slate-800 rounded-full mx-auto mb-2 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-slate-900 mr-2" />
                <div className="w-8 h-1 bg-slate-700 rounded-full" />
              </div>

              {/* Subject bar in mobile client */}
              <div className="px-2 py-1.5 bg-slate-900 border-b border-slate-800 text-[10px] text-slate-300 font-bold truncate">
                {subject || 'No subject'}
              </div>

              {/* Inner iframe */}
              <div className="flex-1 rounded-2xl overflow-hidden bg-white">
                <iframe
                  title="Broadcast mobile preview"
                  srcDoc={previewHtml}
                  className="w-full h-full border-none"
                  sandbox=""
                />
              </div>

              {/* Home bar indicator */}
              <div className="w-24 h-1 bg-slate-700 rounded-full mx-auto mt-2" />
            </div>
          </div>
        )
      ) : (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
          Add a subject and message to see the preview.
        </div>
      )}
    </div>
  );
}
