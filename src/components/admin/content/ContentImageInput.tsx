'use client';

import { AlertCircle, ImagePlus, Loader2, Upload } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { deleteContentImage, uploadContentImage } from '@/lib/actions/content';

interface Props {
  value: string;
  onChange: (url: string) => void;
  label: string;
  hint?: string;
  /** Rendered small by default; the featured image wants a bigger frame. */
  aspect?: 'thumb' | 'wide';
}

/**
 * Image input for the content editor: drop, paste, or pick a file.
 *
 * The editor previously accepted a URL only, which made adding a photo of
 * something that happened yesterday a three-step detour through an external
 * host — the single biggest reason a "visual" editor feels like a text box.
 *
 * Uploads land in the site's public `media` bucket and come back as an
 * absolute URL. The type allowlist is enforced server-side; this component
 * mirrors it only so the author gets an immediate message rather than a
 * round-trip failure.
 */
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const MAX_BYTES = 5 * 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function ContentImageInput({ value, onChange, label, hint, aspect = 'thumb' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      if (!OK_TYPES.includes(file.type)) {
        setError('Use a JPEG, PNG, WebP or GIF. SVG is not allowed.');
        return;
      }
      if (file.size > MAX_BYTES) {
        setError('Image must be 5MB or smaller.');
        return;
      }
      setError(null);
      setBusy(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const { url } = await uploadContentImage(formData);
        onChange(url);
        toast.success('Image uploaded');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setError(message);
        toast.error(message);
      } finally {
        setBusy(false);
      }
    },
    [onChange]
  );

  // Paste-to-upload. An author who screenshots something and hits Cmd+V
  // expects the image to appear, not to be inserted as a filename.
  const onPaste = useCallback(
    (event: React.ClipboardEvent) => {
      const file = [...event.clipboardData.files].find((f) => f.type.startsWith('image/'));
      if (!file) return;
      event.preventDefault();
      void upload(file);
    },
    [upload]
  );

  const remove = useCallback(async () => {
    const previous = value;
    onChange('');
    if (!previous) return;
    // Fire and forget: the reference is already gone from the document, and a
    // failed cleanup must not block the author from removing the image. The
    // server refuses to delete a file that anything still points at, and the
    // two reasons it says no mean different things to the author.
    try {
      const { deleted, retained } = await deleteContentImage(previous);
      if (deleted) return;
      toast.info(
        retained === 'referenced'
          ? 'Removed from the page. The file is still used elsewhere, so it was kept.'
          : 'Removed from the page; the stored file was left in place.'
      );
    } catch {
      toast.info('Removed from the page; the stored file was left in place.');
    }
  }, [onChange, value]);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-600">{label}</p>

      <section
        aria-label={`${label} upload area`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void upload(file);
        }}
        onPaste={onPaste}
        className={`rounded-xl border-2 border-dashed p-3 transition-colors ${
          dragging ? 'border-primary bg-blue-50' : 'border-slate-200 bg-slate-50'
        }`}
      >
        {value ? (
          <div className="flex items-start gap-3">
            <Image
              src={value}
              alt=""
              width={aspect === 'thumb' ? 96 : 320}
              height={aspect === 'thumb' ? 96 : 180}
              unoptimized
              className={`shrink-0 rounded-lg bg-slate-100 object-cover ${
                aspect === 'thumb' ? 'h-16 w-16' : 'h-28 w-48'
              }`}
            />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="truncate text-xs text-slate-500">{value}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Upload size={13} aria-hidden="true" />
                  )}
                  Replace
                </button>
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-rose-50 hover:text-accent-red focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center gap-1.5 rounded-lg py-5 text-center focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={20} className="animate-spin text-primary" aria-hidden="true" />
            ) : (
              <ImagePlus size={20} className="text-slate-400" aria-hidden="true" />
            )}
            <span className="text-xs font-semibold text-slate-600">
              {busy ? 'Uploading…' : 'Drop an image, paste, or click to choose'}
            </span>
            {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
          </button>
        )}
      </section>

      {/* A URL is still valid input — plenty of the chapter's photography
          already lives somewhere else — so this is a real alternative, not a
          fallback hidden behind a disclosure. */}
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…or paste a full image URL"
        aria-label={`${label} URL`}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus-visible:ring-2 focus-visible:ring-primary"
      />

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-accent-red">
          <AlertCircle size={13} className="mt-px shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          // Reset so re-picking the same file fires onChange again.
          e.target.value = '';
        }}
      />
    </div>
  );
}
