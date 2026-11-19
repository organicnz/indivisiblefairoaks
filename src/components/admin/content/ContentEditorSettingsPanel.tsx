'use client';

import { Eye } from 'lucide-react';
import { CONTENT_TYPES, type ContentType } from '@/lib/content';
import { ContentExcerptField } from './ContentExcerptField';
import { ContentImageInput } from './ContentImageInput';

interface ContentEditorSettingsPanelProps {
  title: string;
  status: 'publish' | 'draft';
  onStatusChange: (status: 'publish' | 'draft') => void;
  type: ContentType;
  onTypeChange: (type: ContentType) => void;
  slug: string;
  onSlugChange: (slug: string) => void;
  featuredImage: string;
  onFeaturedImageChange: (url: string) => void;
  metaTitle: string;
  onMetaTitleChange: (value: string) => void;
  metaDescription: string;
  onMetaDescriptionChange: (value: string) => void;
  siteHost: string;
  derivedExcerpt: string;
  excerpt: string;
  onExcerptChange: (value: string) => void;
  onUseGeneratedSummary: () => void;
}

export function ContentEditorSettingsPanel({
  title,
  status,
  onStatusChange,
  type,
  onTypeChange,
  slug,
  onSlugChange,
  featuredImage,
  onFeaturedImageChange,
  metaTitle,
  onMetaTitleChange,
  metaDescription,
  onMetaDescriptionChange,
  siteHost,
  derivedExcerpt,
  excerpt,
  onExcerptChange,
  onUseGeneratedSummary,
}: ContentEditorSettingsPanelProps) {
  return (
    <aside className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-border bg-surface-card p-5 shadow-xs">
        <h2 className="font-display text-xs font-semibold tracking-[-0.01em] text-muted-foreground">
          Page settings
        </h2>

        <label className="block text-xs font-medium text-muted-foreground">
          Status
          {/* This control and the Publish button both name a publish state,
              so both route through `handleSetStatus`. It previously called
              `setStatus` — local state only — which flipped `dirty` and let
              the autosave effect publish or unpublish 2.5s later, taking a
              live page down from a dropdown with no confirmation and no
              toast. Selecting a value here now gets the same guard, the same
              unsaved-edits handling and the same confirmation toast as the
              button. */}
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value as 'publish' | 'draft')}
            className="mt-1 w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="draft">Draft</option>
            <option value="publish">Published</option>
          </select>
        </label>

        <label className="block text-xs font-medium text-muted-foreground">
          Type
          <select
            value={type}
            onChange={(e) => onTypeChange(e.target.value as ContentType)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
          >
            {CONTENT_TYPES.map((option) => (
              <option key={option} value={option}>
                {option[0].toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-muted-foreground">
          URL slug
          <div className="mt-1 flex items-center gap-1 rounded-lg border border-border bg-surface-muted px-2 py-1.5">
            <span className="shrink-0 text-xs text-muted-foreground">/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => onSlugChange(e.target.value)}
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </label>

        {/*
          The hero uses the same uploader as an image block, not a bare URL
          field. A URL box was the only way to set it, and the only URLs that
          pass `saveContent`'s production host check are this site's own —
          which the CMS's own uploader produces. So the control the author was
          offered could not be satisfied by the tool sitting next to it.
        */}
        <ContentImageInput
          value={featuredImage}
          onChange={onFeaturedImageChange}
          label="Featured image"
          hint="The hero at the top of the page, and the share card on social media."
          aspect="wide"
        />
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-surface-card p-5 shadow-xs">
        <h2 className="font-display text-xs font-semibold tracking-[-0.01em] text-muted-foreground">
          Card summary
        </h2>
        <ContentExcerptField
          excerpt={excerpt}
          derivedExcerpt={derivedExcerpt}
          onChange={onExcerptChange}
          onUseGeneratedSummary={onUseGeneratedSummary}
        />
      </div>

      {/*
        SEO meta fields. Stored in content.metadata as meta_title /
        meta_description; generateMetadata uses them when present and falls
        back to the derived title / body excerpt when not. The character
        counts are Google's SERP budgets — a title past ~60 is truncated in
        the results, a description past ~155 is cut mid-sentence.
      */}
      <div className="space-y-3 rounded-2xl border border-border bg-surface-card p-5 shadow-xs">
        <h2 className="font-display text-xs font-semibold tracking-[-0.01em] text-muted-foreground">
          SEO
        </h2>
        <label className="block text-xs font-medium text-muted-foreground">
          Meta title
          <input
            id="content-meta-title"
            type="text"
            value={metaTitle}
            onChange={(e) => onMetaTitleChange(e.target.value)}
            placeholder={title || 'Untitled page'}
            maxLength={80}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
          />
          <span
            className={`mt-0.5 block text-right text-[11px] ${
              metaTitle.length > 60 ? 'font-bold text-accent-red' : 'text-muted-foreground'
            }`}
          >
            {metaTitle.length}/60
          </span>
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Meta description
          <textarea
            id="content-meta-description"
            value={metaDescription}
            onChange={(e) => onMetaDescriptionChange(e.target.value)}
            placeholder={derivedExcerpt || 'No summary yet.'}
            maxLength={200}
            rows={3}
            className="mt-1 w-full resize-none rounded-lg border border-border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary"
          />
          <span
            className={`mt-0.5 block text-right text-[11px] ${
              metaDescription.length > 155 ? 'font-bold text-accent-red' : 'text-muted-foreground'
            }`}
          >
            {metaDescription.length}/155
          </span>
        </label>
      </div>

      {/*
        A search-result preview, not a claim about Google's output — the
        layout mirrors the familiar blue-title / green-URL / grey-snippet
        shape so the author can sanity-check the title and description they
        are about to ship. It shows the meta fields when set, because that
        is what Google will actually use.
      */}
      <div className="space-y-2 rounded-2xl border border-border bg-surface-card p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xs font-semibold tracking-[-0.01em] text-muted-foreground">
            Search preview
          </h2>
          <Eye size={14} className="text-muted-foreground" aria-hidden="true" />
        </div>
        <p className="truncate text-sm font-medium text-[#1a0dab]">
          {metaTitle.trim() || title || 'Untitled page'}
        </p>
        <p className="truncate text-xs text-[#0d6528]">
          {siteHost}/{slug || '…'}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {metaDescription.trim() || derivedExcerpt || 'No summary yet.'}
        </p>
      </div>
    </aside>
  );
}
