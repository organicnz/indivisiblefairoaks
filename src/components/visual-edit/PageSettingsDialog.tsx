'use client';

import { Download, FolderOpen, Globe, Loader2, Upload } from 'lucide-react';
import Image from 'next/image';
import type { FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { copyRegionSlug } from '@/lib/copy-regions';

export function PageSettingsDialog({
  open,
  onOpenChange,
  titleId,
  slugId,
  featuredImageId,
  title,
  slug,
  featuredImage,
  status,
  onTitleChange,
  onSlugChange,
  onFeaturedImageChange,
  onStatusChange,
  activeRegion,
  pathname,
  previewTab,
  onPreviewTabChange,
  onOpenMedia,
  onSave,
  onExport,
  onImport,
  exportDisabled,
  exportTitle,
  importDisabled,
  importTitle,
  saveDisabled,
  saveTitle,
  savingBackend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId: string;
  slugId: string;
  featuredImageId: string;
  title: string;
  slug: string;
  featuredImage: string;
  status: 'publish' | 'draft';
  onTitleChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onFeaturedImageChange: (value: string) => void;
  onStatusChange: (value: 'publish' | 'draft') => void;
  activeRegion: { id: string; label: string } | null;
  pathname: string;
  previewTab: 'serp' | 'social';
  onPreviewTabChange: (value: 'serp' | 'social') => void;
  onOpenMedia: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onExport: () => void;
  onImport: () => void;
  exportDisabled: boolean;
  exportTitle: string;
  importDisabled: boolean;
  importTitle: string;
  saveDisabled: boolean;
  saveTitle: string;
  savingBackend: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-surface-card text-foreground p-6 rounded-3xl">
        <DialogHeader>
          <DialogTitle>Page Settings &amp; Metadata</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Update document metadata and the featured hero image stored in Supabase S3 storage.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSave} className="space-y-4 my-2">
          <div>
            <label htmlFor={titleId} className="block text-xs font-bold text-foreground mb-1">
              Page Title
            </label>
            <input
              id={titleId}
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              required
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor={slugId} className="block text-xs font-bold text-foreground mb-1">
              URL Slug
            </label>
            {activeRegion ? (
              <>
                <input
                  id={slugId}
                  type="text"
                  value={copyRegionSlug(activeRegion.id)}
                  readOnly
                  disabled
                  className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-muted-foreground"
                />
                {/*
                  Read-only, and saying why. The slug is the registry's
                  identity for this region — `CopyRegion` renders
                  `copy-home-hero`, and renaming it here would leave the page
                  rendering a row nobody reads while the page's copy stays
                  frozen. That is the shadowed-CMS failure in a new costume.
                */}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  This is the <strong>{activeRegion.label}</strong> copy region on{' '}
                  <code className="font-mono">{pathname}</code>. Its slug is managed by the
                  region, so it cannot be renamed here.
                </p>
              </>
            ) : (
              <input
                id={slugId}
                type="text"
                value={slug}
                onChange={(e) => onSlugChange(e.target.value)}
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
              />
            )}
          </div>

          <div>
            <label
              htmlFor={featuredImageId}
              className="block text-xs font-bold text-foreground mb-1"
            >
              Featured Hero Image
            </label>
            <div className="flex gap-2">
              <input
                id={featuredImageId}
                type="url"
                value={featuredImage}
                onChange={(e) => onFeaturedImageChange(e.target.value)}
                placeholder="https://...supabase.co/storage/v1/object/public/media/..."
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={onOpenMedia}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-bold text-foreground hover:bg-border shrink-0"
              >
                <FolderOpen size={14} className="text-primary" />
                <span>S3 Storage</span>
              </button>
            </div>
          </div>

          {featuredImage && (
            <div className="relative aspect-video w-full max-h-36 rounded-xl bg-surface-muted overflow-hidden border border-border">
              <Image
                src={featuredImage}
                alt="Hero preview"
                unoptimized
                fill
                className="object-cover"
              />
            </div>
          )}

          {/* Live SERP & Social Sharing Preview */}
          <div className="rounded-2xl border border-border bg-surface-muted/50 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Globe size={13} className="text-primary" />
                <span>Search &amp; Social Preview</span>
              </span>
              <div className="flex items-center rounded-lg border border-border bg-background p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => onPreviewTabChange('serp')}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    previewTab === 'serp'
                      ? 'bg-primary text-white shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  aria-label="Preview Google search snippet"
                >
                  Google SERP
                </button>
                <button
                  type="button"
                  onClick={() => onPreviewTabChange('social')}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    previewTab === 'social'
                      ? 'bg-primary text-white shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  aria-label="Preview social share card"
                >
                  Social Card
                </button>
              </div>
            </div>

            {previewTab === 'serp' ? (
              /* Google SERP Snippet Preview */
              <div className="rounded-xl border border-border/80 bg-background p-3 space-y-1 text-left select-none">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="size-3.5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-black text-primary">
                    I
                  </span>
                  <span className="truncate">indivisiblefairoaks.org</span>
                  <span className="text-muted-foreground/60">&rsaquo;</span>
                  <span className="truncate font-mono text-[10px]">
                    {activeRegion ? pathname.replace(/^\//, '') : slug || 'page'}
                  </span>
                </div>
                <div className="text-sm font-semibold text-blue-500 hover:underline truncate cursor-pointer">
                  {title.trim() || 'Untitled Page'} | Indivisible Fair Oaks
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  Official Indivisible Fair Oaks &amp; Carmichael grassroots action, civic
                  events, and community advocacy in Sacramento County.
                </p>
              </div>
            ) : (
              /* Social Card Preview */
              <div className="rounded-xl border border-border/80 bg-background overflow-hidden text-left select-none shadow-xs">
                {featuredImage ? (
                  <div className="relative aspect-[1.91/1] w-full max-h-32 bg-surface-muted overflow-hidden">
                    <Image
                      src={featuredImage}
                      alt="Social share preview"
                      unoptimized
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-[1.91/1] w-full max-h-24 bg-gradient-to-br from-primary/20 via-background to-accent-gold/10 flex items-center justify-center p-3 text-center">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Indivisible Fair Oaks &amp; Carmichael
                    </span>
                  </div>
                )}
                <div className="p-2.5 space-y-0.5 border-t border-border/60">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    indivisiblefairoaks.org
                  </p>
                  <p className="text-xs font-bold text-foreground truncate">
                    {title.trim() || 'Untitled Page'}
                  </p>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    Grassroots action, community advocacy, and voter empowerment.
                  </p>
                </div>
              </div>
            )}
          </div>

          <fieldset className="border-0 p-0 m-0">
            <legend className="block text-xs font-bold text-foreground mb-1">
              Publication Status
            </legend>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onStatusChange('publish')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                  status === 'publish'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-surface-muted text-foreground hover:bg-border border border-border'
                }`}
              >
                Published
              </button>
              <button
                type="button"
                onClick={() => onStatusChange('draft')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                  status === 'draft'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-surface-muted text-foreground hover:bg-border border border-border'
                }`}
              >
                Draft
              </button>
            </div>
          </fieldset>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onExport}
                disabled={exportDisabled}
                title={exportTitle}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-foreground hover:bg-surface-muted text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Download size={14} className="text-muted-foreground" />
                <span>Export JSON</span>
              </button>
              <button
                type="button"
                onClick={onImport}
                disabled={importDisabled}
                title={importTitle}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-foreground hover:bg-surface-muted text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Upload size={14} className="text-muted-foreground" />
                <span>Import JSON</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-border"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveDisabled}
                title={saveTitle}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-raised hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary"
              >
                {savingBackend && <Loader2 size={13} className="animate-spin" />}
                <span>Save Page Settings</span>
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
