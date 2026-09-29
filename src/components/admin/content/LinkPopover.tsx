'use client';

import { ExternalLink, Link2, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Absolute or site-relative href. */
  onApply: (href: string) => void;
  onRemove: () => void;
  /**
   * The link button lives in the inline toolbar, which sits outside the
   * contenteditable. Opening this popover moves focus out of the text, which
   * collapses the Selection — so the parent stashes the Range and passes a
   * restore function. Without it the link lands at the caret position instead
   * of the selected words.
   */
  restoreSelection: () => void;
}

/**
 * Mirrors `sanitizeWPContent`'s trusted-domain rule.
 *
 * The sanitizer drops an untrusted href at render, so an external link entered
 * here would look correct in the editor and then silently vanish from the
 * published page. Refusing at the point of entry is the only place the author
 * can be told.
 */
const TRUSTED_HOSTS = ['indivisiblefairoaks.org'];

export function isLinkableHref(value: string): { ok: true } | { ok: false; reason: string } {
  const href = value.trim();
  if (!href) return { ok: false, reason: 'Enter a link' };
  if (href.startsWith('/') && !href.startsWith('//')) return { ok: true };
  if (href.startsWith('#')) return { ok: true };
  // `(mailto|tel)` not `(mailto:|tel:)`: the colon belongs outside the group,
  // or the pattern demands a second one and every mailto link is rejected.
  if (/^(mailto|tel):/i.test(href)) return { ok: true };
  if (href.startsWith('//')) {
    return { ok: false, reason: 'Use a full https:// URL, or a path like /contact' };
  }
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { ok: false, reason: 'That is not a URL. Try https://… or /contact' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, reason: 'Only http and https links are allowed' };
  }
  const host = url.hostname.toLowerCase();
  if (TRUSTED_HOSTS.some((d) => host === d || host.endsWith(`.${d}`))) return { ok: true };
  return {
    ok: false,
    reason:
      'External links are removed when the page is published. Link to a page on this site instead.',
  };
}

/**
 * Link editor for the inline toolbar.
 *
 * The editor previously had no way to create a link at all, which for a civic
 * site whose entire purpose is pointing people at other civic sites is a
 * functional hole rather than a missing nicety.
 */
export function LinkPopover({ onApply, onRemove, restoreSelection }: Props) {
  const [href, setHref] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    const result = isLinkableHref(href);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    // Put the caret back before the command runs; the popover stole it.
    restoreSelection();
    onApply(href.trim());
  };

  return (
    <div className="mb-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="flex items-center gap-2">
        <Link2 size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={href}
          onChange={(e) => {
            setHref(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
            if (e.key === 'Escape') onRemove();
          }}
          placeholder="/contact or https://…"
          aria-label="Link URL"
          aria-invalid={error ? true : undefined}
          className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            submit();
          }}
          className="shrink-0 rounded-md px-2 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-primary"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Close link editor"
          className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:text-accent-red focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-[11px] font-medium text-accent-red">
          {error}
        </p>
      ) : (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500">
          <ExternalLink size={11} aria-hidden="true" />
          Links to other sites are removed on publish.
        </p>
      )}
    </div>
  );
}
