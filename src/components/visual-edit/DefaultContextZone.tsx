'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Activity,
  Calendar,
  Database,
  ExternalLink,
  Eye,
  FilePlus2,
  FolderOpen,
  History,
  Layers,
  Link as LinkIcon,
  ListTree,
  Monitor,
  Moon,
  Newspaper,
  Plus,
  RotateCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Tablet,
  UsersRound,
} from 'lucide-react';
import { themeModeLabel } from '@/lib/theme';
import { EditorBlockList } from './EditorBlockList';
import { EditorDocumentPanel } from './EditorDocumentPanel';
import { EditorSupportPanel } from './EditorSupportPanel';
import type { VisualEditorSidebarProps } from './VisualEditorSidebar';

export function DefaultContextZone(props: VisualEditorSidebarProps) {
  const {
    contentRow,
    documentLoadState = 'idle',
    dirty,
    sections,
    activeBlockIndex,
    unsaveableReason = null,
    showSectionBadges,
    showAllSectionBorders,
    showInspector,
    viewportMode,
    deviceOrientation,
    themeMode,
    effectiveTheme,
    modifiedBlocks,
    modifiedDataPoints,
    blockTypeOptions,
  } = props;

  const changeCount = modifiedBlocks.length + modifiedDataPoints.length;
  const showChangeCount = dirty || modifiedDataPoints.length > 0;
  const documentReady = documentLoadState === 'ready';
  const documentOpening = documentLoadState === 'idle' || documentLoadState === 'loading';
  const documentUnavailable = documentLoadState === 'degraded';
  const canMutateDocument = documentReady && !unsaveableReason;
  const themePreviewLabel = `${themeModeLabel(themeMode)}${themeMode === 'system' ? ` (${effectiveTheme})` : ''}`;

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-3 py-3 text-xs">
      {props.isComposerWorkspace && (
        <div
          data-testid="canonical-editing-surface"
          className="rounded-xl border border-accent-gold/40 bg-accent-gold/10 p-2.5"
        >
          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-accent-gold">
            <SlidersHorizontal size={12} />
            <span>Composer workspace</span>
          </span>
          <p className="mt-1 text-[10px] leading-snug text-ink-muted-on-dark">
            Click any block on the page to edit its content and design here. This is the only block
            editor on this route.
          </p>
        </div>
      )}

      <EditorDocumentPanel props={props} />

      {/* ── Command palette & tools ────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={props.onOpenCommandPalette}
          title="Open Command Palette & Jump to Block/DataPoint (⌘K)"
          className="inline-flex w-full items-center gap-1.5 rounded-lg border border-accent-gold/40 bg-accent-gold/10 px-2.5 py-1.5 text-xs font-bold text-accent-gold transition-colors hover:bg-accent-gold/20 cursor-pointer"
        >
          <Search size={13} className="text-accent-gold" />
          <span className="flex-1 text-left">Command</span>
          <kbd className="rounded bg-black/30 px-1 py-0.5 text-[9px] font-mono">⌘K</kbd>
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={props.onOpenDataPointDrawer}
            title="Open Page DataPoints Matrix (⌘K -> DataPoints)"
            aria-label="Open DataPoints Matrix"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-500/10 px-2.5 py-1.5 text-xs font-bold text-sky-300 transition-colors hover:bg-sky-500/20 cursor-pointer"
          >
            <Database size={13} className="text-sky-400" />
            <span>DataPoints</span>
          </button>

          <button
            type="button"
            onClick={props.onOpenA11yAuditor}
            title="Run in-page Accessibility, SEO, and DataPoint audit (⌘⇧A)"
            aria-label="Run Civic A11y and Health Audit"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/10 cursor-pointer"
          >
            <ShieldCheck size={13} className="text-emerald-400" />
            <span>Audit</span>
          </button>
        </div>

        <button
          type="button"
          onClick={props.onOpenDiffModal}
          title="Review visual changes and draft diff against published version (⌘⇧V)"
          className={`inline-flex w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
            dirty || modifiedDataPoints.length > 0
              ? 'border-accent-gold/40 bg-accent-gold/15 text-accent-gold hover:bg-accent-gold/25'
              : 'border-white/10 bg-white/5 text-ink-on-dark hover:bg-white/10'
          }`}
        >
          <Activity size={13} className="text-accent-gold" />
          <span className="flex-1 text-left">Diff</span>
          {showChangeCount && (
            <span className="rounded-full bg-accent-gold/20 px-1.5 py-0.2 text-[9px] font-mono font-bold text-accent-gold">
              {changeCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Display toggles ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={props.onToggleInspector}
          title={
            showInspector
              ? 'Disable live element hover inspector HUD'
              : 'Enable live element hover inspector HUD'
          }
          aria-pressed={showInspector}
          className={`inline-flex w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
            showInspector
              ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
              : 'border-white/10 bg-white/5 text-ink-muted-on-dark hover:bg-white/10'
          }`}
        >
          <Eye size={13} />
          <span className="flex-1 text-left">Element HUD: {showInspector ? 'ON' : 'OFF'}</span>
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={props.onToggleBadges}
            title={
              showSectionBadges ? 'Hide in-page section badges' : 'Show in-page section badges'
            }
            aria-pressed={showSectionBadges}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors ${
              showSectionBadges
                ? 'border-accent-gold/50 bg-accent-gold/20 text-accent-gold'
                : 'border-white/10 bg-white/5 text-ink-muted-on-dark hover:bg-white/10'
            }`}
          >
            <Layers size={13} />
            <span>Badges: {showSectionBadges ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={props.onToggleFrames}
            title={showAllSectionBorders ? 'Hide section frames' : 'Show section frames'}
            aria-pressed={showAllSectionBorders}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors ${
              showAllSectionBorders
                ? 'border-accent-gold/50 bg-accent-gold/20 text-accent-gold'
                : 'border-white/10 bg-white/5 text-ink-muted-on-dark hover:bg-white/10'
            }`}
          >
            <Eye size={13} />
            <span>Frames: {showAllSectionBorders ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* ── Theme preview ──────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={props.onCycleTheme}
        title={`Preview theme: ${themePreviewLabel} (click to cycle)`}
        className="inline-flex w-full items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors duration-200 hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer touch-manipulation focus-visible:ring-1 focus-visible:ring-accent-gold"
      >
        {themeMode === 'light' ? (
          <Sun size={13} className="animate-in fade-in zoom-in-75 text-amber-300 duration-200" />
        ) : themeMode === 'dark' ? (
          <Moon size={13} className="animate-in fade-in zoom-in-75 text-blue-300 duration-200" />
        ) : (
          <span className="relative flex items-center justify-center">
            <Monitor
              size={13}
              className="animate-in fade-in zoom-in-75 text-emerald-300 duration-200"
            />
            <span
              aria-hidden="true"
              className={`absolute -right-0.5 -top-0.5 size-1.5 rounded-full ring-1 ring-secondary ${
                effectiveTheme === 'dark' ? 'bg-sky-400' : 'bg-amber-400'
              }`}
            />
          </span>
        )}
        <span className="flex-1 text-left capitalize">
          {themeModeLabel(themeMode)}
          {themeMode === 'system' ? (
            <span className="ml-1 text-[10px] font-medium lowercase text-ink-muted-on-dark">
              ({effectiveTheme})
            </span>
          ) : null}
        </span>
      </button>

      {/* ── Viewport switcher ──────────────────────────────────────────── */}
      <fieldset
        aria-label="Responsive viewport preview"
        className="inline-flex w-full items-center rounded-lg border border-white/10 bg-white/5 p-0.5"
      >
        <legend className="sr-only">Responsive viewport preview</legend>
        <button
          type="button"
          onClick={() => props.onSetViewportMode('desktop')}
          title="Desktop full viewport (100% width)"
          aria-label="Desktop viewport"
          aria-pressed={viewportMode === 'desktop'}
          className={`flex-1 rounded-md p-1.5 text-xs font-bold transition-colors ${
            viewportMode === 'desktop'
              ? 'bg-accent-gold/20 text-accent-gold'
              : 'text-ink-muted-on-dark hover:text-white'
          }`}
        >
          <Monitor size={13} />
        </button>
        <button
          type="button"
          onClick={() => props.onSetViewportMode('tablet')}
          title="Tablet viewport preview (768px width)"
          aria-label="Tablet viewport"
          aria-pressed={viewportMode === 'tablet'}
          className={`flex-1 rounded-md p-1.5 text-xs font-bold transition-colors ${
            viewportMode === 'tablet'
              ? 'bg-accent-gold/20 text-accent-gold'
              : 'text-ink-muted-on-dark hover:text-white'
          }`}
        >
          <Tablet size={13} />
        </button>
        <button
          type="button"
          onClick={() => props.onSetViewportMode('mobile')}
          title="Mobile viewport preview (390px iPhone width)"
          aria-label="Mobile viewport"
          aria-pressed={viewportMode === 'mobile'}
          className={`flex-1 rounded-md p-1.5 text-xs font-bold transition-colors ${
            viewportMode === 'mobile'
              ? 'bg-accent-gold/20 text-accent-gold'
              : 'text-ink-muted-on-dark hover:text-white'
          }`}
        >
          <Smartphone size={13} />
        </button>
        {viewportMode !== 'desktop' && (
          <>
            <button
              type="button"
              onClick={props.onRotateOrientation}
              title={`Rotate device orientation (${deviceOrientation === 'portrait' ? 'Landscape' : 'Portrait'})`}
              aria-label="Rotate device orientation"
              className="rounded-md p-1.5 text-xs font-bold text-accent-gold transition-colors hover:bg-white/10"
            >
              <RotateCw size={13} />
            </button>
            <span className="px-1.5 text-[10px] font-mono font-bold text-accent-gold">
              {viewportMode === 'mobile'
                ? deviceOrientation === 'portrait'
                  ? '390px'
                  : '844px'
                : deviceOrientation === 'portrait'
                  ? '768px'
                  : '1024px'}
            </span>
          </>
        )}
      </fieldset>

      {/* ── Jump to block ──────────────────────────────────────────────── */}
      {sections.length > 0 && (
        <select
          aria-label="Jump to block"
          onChange={(e) => {
            const blockIndex = Number.parseInt(e.target.value, 10);
            if (Number.isInteger(blockIndex)) props.onJumpToBlock(blockIndex);
          }}
          className="w-full rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-accent-gold"
          value=""
        >
          <option value="" disabled className="bg-secondary text-ink-on-dark">
            Jump to block…
          </option>
          {sections.map((sec) => (
            <option key={sec.key} value={sec.blockIndex} className="bg-secondary text-ink-on-dark">
              {sec.ordinal}. {sec.label}
            </option>
          ))}
        </select>
      )}

      {/* ── Add Block ──────────────────────────────────────────────────── */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            disabled={!canMutateDocument}
            title={
              documentLoadState === 'loading'
                ? 'Wait for the saved document to open before adding a block'
                : documentLoadState === 'degraded'
                  ? 'Reload the saved document before adding a block'
                  : (unsaveableReason ?? 'Add a block to this document')
            }
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary-bright px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-colors hover:bg-primary-light focus-visible:ring-2 focus-visible:ring-accent-gold disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary-bright"
          >
            <Plus size={14} />
            <span>Add Block</span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            side="left"
            sideOffset={8}
            aria-label="Add block"
            className="z-50 w-48 rounded-xl border border-white/15 bg-secondary p-1.5 shadow-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            {blockTypeOptions.map((option) => (
              <DropdownMenu.Item
                key={option.type}
                onSelect={() => props.onAddBlock(option.type)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
              >
                {option.label}
              </DropdownMenu.Item>
            ))}
            <div className="my-1 h-px bg-white/10" />
            <DropdownMenu.Item
              onSelect={() => props.onOpenBlockLibrary(null)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-accent-gold hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
            >
              <Layers size={13} />
              <span>Element Library &amp; Templates…</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* ── Design & page tools ────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => props.onOpenVisualComposer('block', activeBlockIndex ?? 0)}
            title="Visual Composer: Full Design & Box Model Inspector (⌘E)"
            aria-label="Visual Composer Inspector"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-accent-gold/30 bg-accent-gold/15 px-2.5 py-1.5 text-xs font-bold text-accent-gold transition-colors hover:bg-accent-gold/25 focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <SlidersHorizontal size={14} />
            <span>Composer</span>
          </button>

          <button
            type="button"
            onClick={props.onOpenPageNavigator}
            title="Page Structure Navigator & Tree (⌘7)"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-400/15 px-2.5 py-1.5 text-xs font-bold text-sky-300 transition-colors hover:bg-sky-400/25 focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <ListTree size={14} />
            <span>Tree</span>
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => props.onOpenMedia('section')}
            title="Open Supabase S3 Media Library"
            aria-label="Open Supabase S3 Media Library"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <FolderOpen size={14} className="text-accent-gold" />
            <span>Media</span>
          </button>

          <button
            type="button"
            onClick={props.onOpenSettings}
            disabled={!documentReady}
            title={
              documentOpening
                ? 'Wait for the saved document to open before editing page settings'
                : documentUnavailable
                  ? 'Reload the saved document before editing page settings'
                  : 'Edit page title, slug, and featured image'
            }
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-gold disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/10"
          >
            <Settings size={14} />
            <span>Settings</span>
          </button>
        </div>

        {contentRow && (
          <button
            type="button"
            onClick={props.onOpenRevisions}
            disabled={!documentReady}
            title={
              documentOpening
                ? 'Wait for the saved document to open before viewing revisions'
                : documentUnavailable
                  ? 'Reload the saved document before viewing revisions'
                  : 'View page revision history and restore previous snapshots'
            }
            className="inline-flex w-full items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-gold disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/10"
          >
            <History size={14} />
            <span>Revisions</span>
          </button>
        )}
      </div>

      {/* ── Create & CRM ──────────────────────────────────────────────── */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            title="Create or manage: Posts, Events, Bulletins, or Links"
            aria-label="Create or manage: Posts, Events, Bulletins, or Links"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary-bright/40 bg-primary/20 px-2.5 py-1.5 text-xs font-bold text-primary-on-dark transition-colors hover:bg-primary/30 focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <Plus size={14} className="text-accent-gold" />
            <span>Publish</span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="left"
            align="start"
            sideOffset={8}
            className="z-50 min-w-48 rounded-xl border border-white/15 bg-secondary p-1.5 shadow-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            <DropdownMenu.Item
              onSelect={props.onNewPost}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
            >
              <FilePlus2 size={14} className="text-primary-on-dark" />
              <span>New Post</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => props.onOpenCRM('events')}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
            >
              <Calendar size={14} className="text-purple-400" />
              <span>Manage Events</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => props.onOpenCRM('news')}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
            >
              <Newspaper size={14} className="text-accent-gold" />
              <span>Manage Bulletins</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => props.onOpenCRM('links')}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold text-ink-on-dark hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
            >
              <LinkIcon size={14} className="text-emerald-400" />
              <span>Manage Action Links</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => props.onOpenCRM()}
          title="Open Civic CRM (Constituents, Events, News, Links)"
          aria-label="Open Civic CRM (Constituents, Events, News, Links)"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-gold"
        >
          <UsersRound size={14} className="text-emerald-400" />
          <span>CRM</span>
        </button>

        <a
          href="/admin/crm/broadcasts"
          target="_blank"
          rel="noreferrer"
          title="Open CRM Studio (Broadcasts & Constituents)"
          aria-label="Open CRM Studio (Broadcasts & Constituents)"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-ink-on-dark transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-gold"
        >
          <ExternalLink size={14} className="text-primary-on-dark" />
          <span>Studio</span>
        </a>
      </div>

      <EditorSupportPanel props={props} />

      <EditorBlockList props={props} />
    </div>
  );
}
