'use client';

import {
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Settings,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { VisualEditorSidebarProps } from './VisualEditorSidebar';
import type { ImageEditSession } from './VisualEditOverlay';

export function ImageContextZone(props: VisualEditorSidebarProps & { imageSession: ImageEditSession }) {
  const { imageSession } = props;
  // A const, because the onClick closure below cannot inherit the JSX
  // conditional's narrowing — a narrow const does.
  const imageBlockIndex = imageSession.blockIndex;
  const savedAlt = imageSession.element.alt || '';
  const [altText, setAltText] = useState(savedAlt);
  const [isSavingAlt, setIsSavingAlt] = useState(false);

  /**
   * Follow the session's current alt. The sidebar outlives individual image
   * sessions and the dialog writes through this same element, so a stale local
   * draft would otherwise show the previous image's description or overwrite a
   * dialog save on the next Save. Only a changed value resets the draft.
   */
  useEffect(() => {
    setAltText(savedAlt);
  }, [savedAlt]);

  const imageWriteBlocked = props.documentLoadState !== 'ready';
  const imageWriteBlockedReason =
    props.documentLoadState === 'loading' || props.documentLoadState === 'idle'
      ? 'Wait for the saved document to open before changing this image'
      : props.documentLoadState === 'degraded'
        ? 'Reload the saved document before changing this image'
        : 'Wait for the visual editor to finish opening before changing this image';

  const handleSaveAlt = async () => {
    if (isSavingAlt || imageWriteBlocked) return;
    setIsSavingAlt(true);
    try {
      if (props.onSaveImageAlt) {
        await props.onSaveImageAlt(imageSession, altText);
        setAltText(imageSession.element.alt || '');
      } else {
        props.onSetAltTextModal({
          session: imageSession,
          value: altText,
        });
      }
    } finally {
      setIsSavingAlt(false);
    }
  };

  return (
    <div
      data-inline-toolbar="true"
      role="group"
      aria-label="Image asset controls"
      className="flex flex-1 flex-col gap-2 overflow-y-auto border-t-2 border-sky-400/40 px-3 py-4 text-xs text-white"
    >
      <div className="flex items-center justify-between border-b border-white/15 pb-2">
        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-sky-400">
          <ImageIcon size={12} />
          <span>Image Asset</span>
        </span>
      </div>

      <div className="my-1 h-px w-full bg-white/15" />

      <button
        type="button"
        disabled={imageWriteBlocked}
        onClick={() => props.onOpenMedia('image-replace')}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-primary-bright px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-primary-light shadow-xs disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary-bright"
        title={
          imageWriteBlocked
            ? imageWriteBlockedReason
            : 'Replace image with Supabase S3 Storage media'
        }
      >
        <ImagePlus size={13} />
        <span>Replace</span>
      </button>

      <button
        type="button"
        disabled={props.isUploadingImage || imageWriteBlocked}
        onClick={props.onUploadClick}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-white/20 shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
        title={
          imageWriteBlocked
            ? imageWriteBlockedReason
            : 'Directly upload replacement image from your device'
        }
      >
        {props.isUploadingImage ? (
          <Loader2 size={12} className="animate-spin text-accent-gold" />
        ) : (
          <Upload size={12} className="text-primary-on-dark" />
        )}
        <span>{props.isUploadingImage ? 'Uploading…' : 'Upload'}</span>
      </button>

      <div className="mt-1 flex flex-col gap-1.5 rounded-lg border border-white/10 bg-white/5 p-2">
        <label
          htmlFor="sidebar-image-alt-input"
          className="text-[10px] font-bold uppercase tracking-wider text-slate-300"
        >
          Alt Text (Accessibility)
        </label>
        <div className="flex items-center gap-1.5">
          <input
            id="sidebar-image-alt-input"
            type="text"
            disabled={isSavingAlt || imageWriteBlocked}
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSaveAlt();
              }
            }}
            placeholder="Describe image for screen readers"
            className="min-w-0 flex-1 rounded border border-white/15 bg-slate-900 px-2 py-1 text-xs text-white placeholder:text-white/30 focus:border-accent-gold/60 focus:outline-none disabled:cursor-wait disabled:opacity-60"
          />
          <button
            type="button"
            disabled={isSavingAlt || imageWriteBlocked}
            onClick={() => void handleSaveAlt()}
            title={
              imageWriteBlocked ? imageWriteBlockedReason : 'Save the image description'
            }
            className="rounded bg-sky-600 hover:bg-sky-500 px-2.5 py-1 text-[11px] font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSavingAlt ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() =>
          props.onSetAltTextModal({
            session: imageSession,
            value: altText,
          })
        }
        className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        title="Edit image alt text"
        aria-label="Edit image alt text"
      >
        <Settings size={12} />
        <span className="hidden sm:inline">Alt Text Dialog</span>
      </button>

      {imageBlockIndex !== null && (
        <button
          type="button"
          onClick={() => props.onOpenVisualComposer('block', imageBlockIndex)}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-accent-gold/40 bg-accent-gold/20 px-2 py-1 text-[11px] font-bold text-accent-gold transition-colors hover:bg-accent-gold/30"
          title="Customize Image Box Model, Corners, Borders & Hover in Visual Composer (⌘E)"
          aria-label="Image Visual Composer"
        >
          <SlidersHorizontal size={12} />
          <span className="hidden sm:inline">Styles</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => props.onCancelImageEdit(imageSession)}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        title="Dismiss image controls"
        aria-label="Dismiss image controls"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Default context zone — toolbar, block list, viewport switcher
// ══════════════════════════════════════════════════════════════════════════
