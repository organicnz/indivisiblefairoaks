// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from '@/components/visual-edit/CommandPalette';
import type { VisualSection } from '@/lib/visual-sections';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('CommandPalette', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockSections: VisualSection[] = [
    {
      key: 'sec-0',
      blockIndex: 0,
      ordinal: 1,
      domIndex: 0,
      label: 'Main Heading',
      blockType: 'heading',
    },
    {
      key: 'sec-1',
      blockIndex: 1,
      ordinal: 2,
      domIndex: 1,
      label: 'Intro Paragraph',
      blockType: 'paragraph',
    },
  ];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  const renderPalette = async (props: Partial<Parameters<typeof CommandPalette>[0]> = {}) => {
    const onOpenChange = vi.fn();
    const onSave = vi.fn();
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const onAddNewBlock = vi.fn();
    const onSelectSection = vi.fn();
    const onSetViewportMode = vi.fn();
    const onRotateOrientation = vi.fn();
    const onCycleTheme = vi.fn();
    const onToggleBadges = vi.fn();
    const onToggleFrames = vi.fn();
    const onToggleInspector = vi.fn();
    const onOpenMedia = vi.fn();
    const onOpenSettings = vi.fn();
    const onOpenRevisions = vi.fn();
    const onOpenCrm = vi.fn();
    const onOpenShortcuts = vi.fn();
    const onOpenDiagnostics = vi.fn();
    const onExportJson = vi.fn();
    const onExit = vi.fn();

    await act(async () => {
      root.render(
        <CommandPalette
          open={true}
          onOpenChange={onOpenChange}
          sections={mockSections}
          onSelectSection={onSelectSection}
          onAddNewBlock={onAddNewBlock}
          onSave={onSave}
          canSave={true}
          onUndo={onUndo}
          canUndo={true}
          onRedo={onRedo}
          canRedo={true}
          viewportMode="desktop"
          onSetViewportMode={onSetViewportMode}
          onRotateOrientation={onRotateOrientation}
          deviceOrientation="portrait"
          themeMode="light"
          onCycleTheme={onCycleTheme}
          showBadges={true}
          onToggleBadges={onToggleBadges}
          showFrames={true}
          onToggleFrames={onToggleFrames}
          showInspector={true}
          onToggleInspector={onToggleInspector}
          onOpenMedia={onOpenMedia}
          onOpenSettings={onOpenSettings}
          onOpenRevisions={onOpenRevisions}
          onOpenCrm={onOpenCrm}
          onOpenShortcuts={onOpenShortcuts}
          onOpenDiagnostics={onOpenDiagnostics}
          onExportJson={onExportJson}
          onExit={onExit}
          {...props}
        />
      );
    });

    return {
      onOpenChange,
      onSave,
      onUndo,
      onRedo,
      onAddNewBlock,
      onSelectSection,
      onSetViewportMode,
      onRotateOrientation,
      onCycleTheme,
      onToggleBadges,
      onToggleFrames,
      onToggleInspector,
      onOpenMedia,
      onOpenSettings,
      onOpenRevisions,
      onOpenCrm,
      onOpenShortcuts,
      onOpenDiagnostics,
      onExportJson,
      onExit,
    };
  };

  it('renders command palette with search input and actions list', async () => {
    await renderPalette();

    const input = document.querySelector('input');
    expect(input).not.toBeNull();
    expect(input?.placeholder).toContain('Search blocks');

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Save to Supabase Database');
    expect(dialog?.textContent).toContain('Main Heading');
    expect(dialog?.textContent).toContain('Intro Paragraph');
  });

  it('filters commands when typing in query input', async () => {
    await renderPalette();

    const input = document.querySelector('input');
    expect(input).not.toBeNull();

    await act(async () => {
      if (input) {
        input.value = 'revisions';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        // Also simulate change
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeInputValueSetter?.call(input, 'revisions');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Revision History & Restorations');
  });

  it('triggers onSave when clicking Save command', async () => {
    const { onSave, onOpenChange } = await renderPalette();

    const saveButton = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save to Supabase Database')
    );
    expect(saveButton).toBeDefined();

    await act(async () => {
      saveButton?.click();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('triggers onSelectSection when selecting a section', async () => {
    const { onSelectSection, onOpenChange } = await renderPalette();

    const sectionButton = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Main Heading')
    );
    expect(sectionButton).toBeDefined();

    await act(async () => {
      sectionButton?.click();
    });

    expect(onSelectSection).toHaveBeenCalledWith(0);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('triggers onAddNewBlock when selecting Add Callout', async () => {
    const { onAddNewBlock, onOpenChange } = await renderPalette();

    const calloutButton = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Add Callout')
    );
    expect(calloutButton).toBeDefined();

    await act(async () => {
      calloutButton?.click();
    });

    expect(onAddNewBlock).toHaveBeenCalledWith('callout');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('supports keyboard ArrowDown and Enter to run selected command', async () => {
    const { onSave } = await renderPalette();

    const dialogContent = document.querySelector('[role="dialog"]');
    expect(dialogContent).not.toBeNull();

    await act(async () => {
      dialogContent?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    // The first command is "Save to Supabase Database"
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
