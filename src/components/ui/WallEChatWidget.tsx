'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { DataPoint } from '@/components/ui/DataPoint';
import { useDataPoints } from '@/hooks/useDataPoints';
import { WallEAvatar } from './WallEChatAvatar';
import type { Availability } from './WallEChatPanel';

const WallEChatPanel = dynamic(
  () => import('./WallEChatPanel').then((module) => module.WallEChatPanel),
  { ssr: false }
);

const STATUS_DOTS: Record<Availability, string> = {
  idle: '',
  checking: 'bg-amber-400',
  online: 'bg-emerald-500',
  offline: 'bg-rose-500',
};

function preloadPanel() {
  void import('./WallEChatPanel');
}

export function WallEChatWidget() {
  const { dataPoints } = useDataPoints('walle');
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [availability, setAvailability] = useState<Availability>('idle');

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setHasOpened(true);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <div className="fixed z-[60] floating-safe-position">
        {hasOpened && (
          <WallEChatPanel availability={availability} onAvailabilityChange={setAvailability} />
        )}

        <Dialog.Trigger asChild>
          <button
            type="button"
            aria-label={
              open
                ? dataPoints['walle.btn.close_label'] || 'Close WALL-E assistant'
                : dataPoints['walle.launcher_label'] || 'Open WALL-E assistant'
            }
            onPointerEnter={preloadPanel}
            onFocus={preloadPanel}
            className="group relative ml-auto flex size-14 cursor-pointer items-center justify-center rounded-full border border-primary bg-primary text-white shadow-float transition-colors duration-300 ease-out hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 dark:border-primary-bright dark:bg-primary-bright dark:hover:bg-primary"
          >
            {open ? (
              <span
                className="relative flex items-center justify-center text-white transition-transform duration-300 group-hover:rotate-90 animate-in fade-in zoom-in-75 duration-200"
                aria-hidden="true"
              >
                <X size={24} strokeWidth={2.5} />
              </span>
            ) : (
              <span className="relative flex size-full items-center justify-center animate-in fade-in zoom-in-75 duration-200">
                <WallEAvatar inButton />
                {/* Status dot reflects the last real check, not page load. */}
                {availability !== 'idle' && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center"
                  >
                    <span
                      className={`relative inline-flex size-3 rounded-full border-2 border-white dark:border-white/10 shadow-xs ${STATUS_DOTS[availability]}`}
                    />
                  </span>
                )}
              </span>
            )}
            {/* Tooltip */}
            <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-sm border border-white/10 bg-secondary px-3 py-1.5 text-xs font-bold text-white opacity-0 transition-opacity duration-300 ease-out hover-capable:group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-white/5 dark:text-slate-100">
              {open ? (
                <DataPoint as="span" name="walle.tooltip.close" initialData={dataPoints}>
                  Close
                </DataPoint>
              ) : (
                <DataPoint as="span" name="walle.tooltip" initialData={dataPoints}>
                  Ask WALL-E
                </DataPoint>
              )}
            </span>
          </button>
        </Dialog.Trigger>
      </div>
    </Dialog.Root>
  );
}
