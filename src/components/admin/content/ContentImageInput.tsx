'use client';

import { AlertCircle, FolderOpen, ImagePlus, Loader2, Upload } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CRMMediaLibraryModal } from '@/components/admin/crm/composer/CRMMediaLibraryModal';
import { deleteContentImage, uploadContentImage } from '@/lib/actions/content';
import { isOwnImageUrl } from '@/lib/own-media';

interface Props {
  value: string;
  /**
   * `dimensions` carries the intrinsic size, so the block can emit `width` /
   * `height` and the browser can reserve the image's box before the bytes
   * arrive.
   *
   * It is optional because the hero field has no use for it — it renders in a
   * fixed 16/9 frame — and because a URL that cannot be measured yields `null`
   * for both, which is "unknown", not "zero".
   */
  onChange: (url: string, dimensions?: { width: number | null; height: number | null }) => void;
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

/**
 * How long a typed URL must sit still before it is probed.
 *
 * Long enough that a pasted URL is measured once rather than once per
 * character, and short enough that the author has not moved on before the
 * dimensions land.
 */
const URL_PROBE_DEBOUNCE_MS = 600;

/** An absolute http(s) URL with a path — not a half-typed scheme or a bare host. */
const ABSOLUTE_IMAGE_URL = /^https?:\/\/[^\s/]+\/\S*$/i;

export function ContentImageInput({ value, onChange, label, hint, aspect = 'thumb' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);

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
        // The server measures the image from the bytes it just wrote, so the
        // dimensions arrive with the URL rather than being reported by the
        // browser afterwards. Both of the paths that carry a `File` — picker,
        // drop and paste — land here, and this is the one that cannot be wrong:
        // the browser's own report does not exist until the image has already
        // loaded, by which point the shift it would have prevented has happened.
        const { url, width, height } = await uploadContentImage(formData);
        onChange(url, { width, height });
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

  /**
   * The intrinsic size of an image already on the internet, or `null`.
   *
   * The upload path measures from the bytes it just wrote, which is
   * authoritative. This path has no bytes — only a URL the author typed — and
   * without a measurement the block emits no `width` / `height`, so the image
   * shifts the page as it arrives. Probing with a detached `Image` closes that.
   *
   * `naturalWidth` / `naturalHeight` are metadata, not pixels, so this works for
   * a cross-origin URL without a CORS header — unlike reading the image into a
   * canvas, which would taint. The request is one the page was going to make
   * anyway to display the image, and the browser serves the second from cache.
   *
   * Deliberately `window.Image`: the module's `Image` is `next/image`.
   */
  const probeRemoteSize = useCallback(
    (url: string): Promise<{ width: number; height: number } | null> =>
      new Promise((resolve) => {
        const probe = new window.Image();
        // Both outcomes are settled exactly once because a promise can only
        // settle once — that, and not the detachment below, is what stops a
        // late second event producing a second edit. Dropping the handlers
        // releases the two closures so they do not outlive the probe element.
        const settle = (result: { width: number; height: number } | null) => {
          probe.onload = null;
          probe.onerror = null;
          resolve(result);
        };
        probe.onload = () => {
          const { naturalWidth: width, naturalHeight: height } = probe;
          // A zero means a degenerate image, and `width="0"` renders nothing.
          settle(width > 0 && height > 0 ? { width, height } : null);
        };
        probe.onerror = () => settle(null);
        probe.src = url;
      }),
    []
  );

  /**
   * `onChange` is an inline arrow in the parent, so it is a new function on
   * every render. Reading it through a ref keeps the probe effect keyed on the
   * URL alone — otherwise the effect would re-run on every parent render and
   * re-probe an image it had already measured.
   */
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  /** The URL most recently handed to the probe, so each one is tried once. */
  const [probed, setProbed] = useState<string | null>(null);

  useEffect(() => {
    // Our own uploads are already measured server-side from the bytes, so
    // probing them would spend a request to learn what we already know.
    if (isOwnImageUrl(value)) return;
    if (!ABSOLUTE_IMAGE_URL.test(value)) return;
    if (probed === value) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void probeRemoteSize(value).then((dimensions) => {
        if (cancelled) return;
        setProbed(value);
        // Re-emit the *same* URL with the measurement attached, so `src` and
        // `width` / `height` land as one update and one undo step. The intent
        // key is unchanged from the keystrokes, so the whole thing coalesces
        // into the single edit the author was already making.
        //
        // A failed probe emits nothing: the block already holds `null` for both
        // dimensions, and writing `null` again would be a second undo step that
        // changes nothing.
        if (dimensions) onChangeRef.current(value, dimensions);
      });
    }, URL_PROBE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, probed, probeRemoteSize]);

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
      <p className="text-xs font-medium text-muted-foreground">{label}</p>

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
          dragging ? 'border-primary bg-blue-50' : 'border-border bg-surface-muted'
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
              className={`shrink-0 rounded-lg bg-surface-muted object-cover ${
                aspect === 'thumb' ? 'h-16 w-16' : 'h-28 w-48'
              }`}
            />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="truncate text-xs text-muted-foreground">{value}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-border focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
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
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-rose-50 hover:text-accent-red focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
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
              <Loader2
                size={20}
                className="animate-spin text-primary dark:text-primary-on-dark"
                aria-hidden="true"
              />
            ) : (
              <ImagePlus size={20} className="text-muted-foreground" aria-hidden="true" />
            )}
            <span className="text-xs font-semibold text-muted-foreground">
              {busy ? 'Uploading…' : 'Drop an image, paste, or click to choose'}
            </span>
            {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
          </button>
        )}
      </section>

      {/* A URL is still valid input — plenty of the chapter's photography
          already lives somewhere else — so this is a real alternative, not a
          fallback hidden behind a disclosure. */}
      <div className="flex items-center gap-2">
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="…or paste a full image URL"
          aria-label={`${label} URL`}
          className="flex-1 rounded-lg border border-border px-3 py-2 text-xs focus-visible:ring-2 focus-visible:ring-primary"
        />
        <button
          type="button"
          onClick={() => setMediaModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface-card hover:bg-surface-muted text-xs font-bold text-foreground transition-colors shadow-2xs shrink-0"
          title="Browse Supabase S3 Media Library"
        >
          <FolderOpen size={13} className="text-primary dark:text-primary-on-dark" />
          <span>Storage</span>
        </button>
      </div>

      {mediaModalOpen && (
        <CRMMediaLibraryModal
          isOpen={mediaModalOpen}
          onClose={() => setMediaModalOpen(false)}
          onSelectMedia={(item) => {
            onChange(item.url, { width: item.width ?? null, height: item.height ?? null });
            setMediaModalOpen(false);
          }}
          initialFolder="content"
        />
      )}

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
