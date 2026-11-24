'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';

const CivicCommandPaletteDialog = dynamic(
  () => import('./CivicCommandPaletteDialog').then((module) => module.CivicCommandPaletteDialog),
  { ssr: false }
);

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

function preloadDialog() {
  void import('./CivicCommandPaletteDialog');
}

export function CivicCommandPalette({
  isOpen: controlledOpen,
  setIsOpen: setControlledOpen,
}: {
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
} = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen ?? internalOpen;
  const [hasOpened, setHasOpened] = useState(Boolean(controlledOpen));

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (setControlledOpen) setControlledOpen(next);
      else setInternalOpen(next);
      if (next) setHasOpened(true);
    },
    [setControlledOpen]
  );

  useEffect(() => {
    if (isOpen) setHasOpened(true);
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        handleOpenChange(!isOpen);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenChange, isOpen]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          // p-2 plus a 20px glyph is 36px — under the 44px minimum target.
          className={`inline-flex size-11 items-center justify-center rounded-sm text-foreground/75 transition-colors duration-300 ease-out hover:bg-surface-muted hover:text-foreground ${FOCUS_RING}`}
          aria-label="Search site (Command K)"
          title="Search site (⌘K)"
          onPointerEnter={preloadDialog}
          onFocus={preloadDialog}
        >
          <Search size={20} aria-hidden="true" />
        </button>
      </Dialog.Trigger>

      {hasOpened && <CivicCommandPaletteDialog onClose={() => handleOpenChange(false)} />}
    </Dialog.Root>
  );
}
