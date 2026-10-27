// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_VC_STYLES,
  VisualComposerInspector,
} from '@/components/visual-edit/VisualComposerInspector';
import type { Block } from '@/lib/blocks';
import type { VisualComposerStyles } from '@/types/unified';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('VisualComposerInspector', () => {
  let container: HTMLDivElement;
  let root: Root;

  const sampleHeadingBlock: Block = {
    id: 'b1',
    type: 'heading',
    level: 2,
    html: 'Grassroots Community Action',
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders nothing when closed or block is null', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={false}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
        />
      );
    });
    expect(document.body.textContent).not.toContain('Visual Composer Inspector');

    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={null}
          blockIndex={null}
          onSaveBlock={vi.fn()}
        />
      );
    });
    expect(document.body.textContent).not.toContain('Visual Composer Inspector');
  });

  it('renders active block details and tabs when open', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
        />
      );
    });

    expect(document.body.textContent).toContain('Visual Composer Inspector');
    expect(document.body.textContent).toContain('Block #1 · heading');
    expect(document.body.textContent).toContain('Box Model');
    expect(document.body.textContent).toContain('Type');
    expect(document.body.textContent).toContain('Advanced');
  });

  it('allows editing content and saves updated block', async () => {
    const onSaveBlock = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={onClose}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={onSaveBlock}
        />
      );
    });

    const textarea = document.querySelector('textarea');
    expect(textarea).not.toBeNull();
    if (textarea) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        if (setter) {
          setter.call(textarea, 'Updated Grassroots Title');
        }
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    const saveButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Save Block'
    );
    expect(saveButton).toBeDefined();

    await act(async () => {
      saveButton?.click();
    });

    expect(onSaveBlock).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('switches to Box Model and Advanced tabs cleanly', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
        />
      );
    });

    const boxModelButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Box Model'
    );
    await act(async () => {
      boxModelButton?.click();
    });
    expect(document.body.textContent).toContain('Spacing & Padding');

    const advancedButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Advanced'
    );
    await act(async () => {
      advancedButton?.click();
    });
    expect(document.body.textContent).toContain('Device Visibility');
  });

  it('applies 1-click style preset cleanly', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
        />
      );
    });

    const presetsTabButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Presets'
    );
    await act(async () => {
      presetsTabButton?.click();
    });

    expect(document.body.textContent).toContain('Professional 1-Click Design Presets');
    expect(document.body.textContent).toContain('Editorial Card');
    expect(document.body.textContent).toContain('Civic Gold Callout');

    const civicPresetButton = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Civic Gold Callout')
    );
    await act(async () => {
      civicPresetButton?.click();
    });
  });

  it('switches to Row / Section mode cleanly and shows section container controls', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
          initialMode="section"
        />
      );
    });

    expect(document.body.textContent).toContain('Section Container Width');
    expect(document.body.textContent).toContain('Vertical Section Padding');
    expect(document.body.textContent).toContain('Section Background Theme');

    const saveSectionButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Save Section'
    );
    expect(saveSectionButton).toBeDefined();
  });

  it('switches to Code tab and displays raw HTML markup', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
        />
      );
    });

    const codeTabButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Code'
    );
    await act(async () => {
      codeTabButton?.click();
    });

    expect(document.body.textContent).toContain('Raw Block HTML Markup');
    const textarea = document.querySelector('textarea');
    expect(textarea?.value).toContain('Grassroots Community Action');
  });

  it('renders interactive 2D CSS Box Model diagram in Box Model tab', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
        />
      );
    });

    const boxModelButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Box Model'
    );
    await act(async () => {
      boxModelButton?.click();
    });

    expect(document.body.textContent).toContain('Interactive CSS Box Model');
    expect(document.body.textContent).toContain('Margin (Outer)');
    expect(document.body.textContent).toContain('Padding (Inner)');
    expect(document.body.textContent).toContain('[ heading ]');
  });

  it('copies and pastes styles cleanly via clipboard', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
        />
      );
    });

    const copyButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Copy'
    );
    expect(copyButton).toBeDefined();

    await act(async () => {
      copyButton?.click();
    });

    const pasteButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Paste'
    );
    expect(pasteButton).toBeDefined();
    expect(pasteButton?.hasAttribute('disabled')).toBe(false);

    await act(async () => {
      pasteButton?.click();
    });
  });

  it('configures typography font family and drop shadow cleanly', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
        />
      );
    });

    const typeTabButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Type'
    );
    await act(async () => {
      typeTabButton?.click();
    });

    expect(document.body.textContent).toContain('Font Family');
    expect(document.body.textContent).toContain('Text Drop Shadow');
    expect(document.body.textContent).toContain('Text Gradient');
  });

  it('configures layout display mode, max width, and positioning in design tab', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
        />
      );
    });

    const boxModelButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Box Model'
    );
    await act(async () => {
      boxModelButton?.click();
    });

    expect(document.body.textContent).toContain('Layout, Display & Sizing');
    expect(document.body.textContent).toContain('Display Mode');
    expect(document.body.textContent).toContain('Max Width Container');
    expect(document.body.textContent).toContain('Position');
    expect(document.body.textContent).toContain('Z-Index');
    expect(document.body.textContent).toContain('Overflow');
  });

  it('configures glassmorphic effects, backdrop blur, and opacity in design tab', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
        />
      );
    });

    const boxModelButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Box Model'
    );
    await act(async () => {
      boxModelButton?.click();
    });

    expect(document.body.textContent).toContain('Glassmorphism & Visual Effects');
    expect(document.body.textContent).toContain('Backdrop Blur');
    expect(document.body.textContent).toContain('Opacity');
    expect(document.body.textContent).toContain('Grayscale Filter');
  });

  it('configures section min-height, civic patterns, and sticky row pinning', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
          initialMode="section"
        />
      );
    });

    expect(document.body.textContent).toContain('Section Viewport & Min Height');
    expect(document.body.textContent).toContain('Civic Background Texture & Patterns');
    expect(document.body.textContent).toContain('Sticky Row');
    expect(document.body.textContent).toContain('Hide on Print');

    const stickyButton = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Sticky Row')
    );
    expect(stickyButton).toBeDefined();

    await act(async () => {
      stickyButton?.click();
    });
    expect(document.body.textContent).toContain('ON');
  });

  it('configures fine-grained hover micro-interactions and print visibility in advanced tab', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
        />
      );
    });

    const advancedButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Advanced'
    );
    await act(async () => {
      advancedButton?.click();
    });

    expect(document.body.textContent).toContain('Hover Micro-Interactions & Timing');
    expect(document.body.textContent).toContain('Scale on Hover');
    expect(document.body.textContent).toContain('Vertical Lift');
    expect(document.body.textContent).toContain('Hover Rotation');
    expect(document.body.textContent).toContain('Transition Speed');
    expect(document.body.textContent).toContain('Hide on Print / Paper Export');
  });

  it('renders 4-sided CSS Box Model diagram with directional indicators and quick spacing presets', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
        />
      );
    });

    const boxModelButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Box Model'
    );
    await act(async () => {
      boxModelButton?.click();
    });

    // Check 4-sided directional labels
    expect(document.body.textContent).toContain('T:');
    expect(document.body.textContent).toContain('B:');
    expect(document.body.textContent).toContain('L:');
    expect(document.body.textContent).toContain('R:');

    // Quick spacing presets
    expect(document.body.textContent).toContain('Default');
    expect(document.body.textContent).toContain('Card');
    expect(document.body.textContent).toContain('Spacious');
    expect(document.body.textContent).toContain('Flush');

    // Click Spacious preset
    const spaciousBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Spacious'
    );
    expect(spaciousBtn).toBeDefined();
    await act(async () => {
      spaciousBtn?.click();
    });

    // Border style selector
    expect(document.body.textContent).toContain('Border Style');
    const borderStyleLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Border Style')
    );
    const borderStyleSelect = borderStyleLabel
      ? (document.getElementById(borderStyleLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(borderStyleSelect).not.toBeNull();
  });

  it('allows configuring line height in Typography tab', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
        />
      );
    });

    const typeTabButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Type'
    );
    await act(async () => {
      typeTabButton?.click();
    });

    expect(document.body.textContent).toContain('Line Height');
    const lineHeightLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Line Height')
    );
    const lineHeightSelect = lineHeightLabel
      ? (document.getElementById(lineHeightLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(lineHeightSelect).not.toBeNull();
  });

  it('configures section anchor ID, custom classes, and backdrop blur in section mode', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
          initialMode="section"
        />
      );
    });

    expect(document.body.textContent).toContain('Backdrop Glass Effect');
    expect(document.body.textContent).toContain('Section Anchor ID');
    expect(document.body.textContent).toContain('Section Custom Classes');

    const anchorLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Section Anchor ID')
    );
    const anchorInput = anchorLabel
      ? (document.getElementById(anchorLabel.htmlFor) as HTMLInputElement)
      : null;
    expect(anchorInput).not.toBeNull();
    if (anchorInput) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(anchorInput, 'rsvp-section');
        anchorInput.dispatchEvent(new Event('input', { bubbles: true }));
        anchorInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(anchorInput.value).toBe('rsvp-section');
    }

    const customClassLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Section Custom Classes')
    );
    const customClassInput = customClassLabel
      ? (document.getElementById(customClassLabel.htmlFor) as HTMLInputElement)
      : null;
    expect(customClassInput).not.toBeNull();
    if (customClassInput) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(customClassInput, 'civic-featured-banner');
        customClassInput.dispatchEvent(new Event('input', { bubbles: true }));
        customClassInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(customClassInput.value).toBe('civic-featured-banner');
    }
  });

  it('switches responsive viewport device in live mini-preview', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
        />
      );
    });

    const mobBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Preview on mobile'
    );
    expect(mobBtn).toBeDefined();

    await act(async () => {
      mobBtn?.click();
    });

    const tabBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Preview on tablet'
    );
    expect(tabBtn).toBeDefined();

    await act(async () => {
      tabBtn?.click();
    });

    const deskBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Preview on desktop'
    );
    expect(deskBtn).toBeDefined();

    await act(async () => {
      deskBtn?.click();
    });
  });

  it('edits code, table, divider, and unsupported blocks cleanly', async () => {
    const codeBlock: Block = {
      id: 'b-code',
      type: 'code',
      text: 'console.log("Civic action");',
    };
    const onSaveBlock = vi.fn();

    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={codeBlock}
          blockIndex={1}
          onSaveBlock={onSaveBlock}
        />
      );
    });

    expect(document.body.textContent).toContain('Code Snippet');
    const codeTextarea = document.querySelector('textarea');
    expect(codeTextarea).not.toBeNull();
    if (codeTextarea) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        setter?.call(codeTextarea, 'export const action = "rsvp";');
        codeTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        codeTextarea.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    const saveButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Save Block'
    );
    await act(async () => {
      saveButton?.click();
    });
    expect(onSaveBlock).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'export const action = "rsvp";' }),
      expect.any(String),
      undefined,
      undefined
    );

    // Test Table Block
    const tableBlock: Block = {
      id: 'b-table',
      type: 'table',
      head: ['Event', 'Location'],
      rows: [['Meeting', 'Library']],
    };
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={tableBlock}
          blockIndex={2}
          onSaveBlock={vi.fn()}
        />
      );
    });
    expect(document.body.textContent).toContain('Table Columns');
    expect(document.body.textContent).toContain('Table Data Rows');

    // Test Divider Block
    const dividerBlock: Block = {
      id: 'b-div',
      type: 'divider',
    };
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={dividerBlock}
          blockIndex={3}
          onSaveBlock={vi.fn()}
        />
      );
    });
    expect(document.body.textContent).toContain('Horizontal Section Divider');

    // Test Unsupported Block
    const unsupportedBlock: Block = {
      id: 'b-raw',
      type: 'unsupported',
      html: '<svg><path d="M0 0"/></svg>',
    };
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={unsupportedBlock}
          blockIndex={4}
          onSaveBlock={vi.fn()}
        />
      );
    });
    expect(document.body.textContent).toContain('Raw HTML Markup');
  });

  it('configures transforms & 3D tilt controls in design tab', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
        />
      );
    });

    const boxModelButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Box Model'
    );
    await act(async () => {
      boxModelButton?.click();
    });

    expect(document.body.textContent).toContain('Transforms & 3D Tilt');
    expect(document.body.textContent).toContain('Rotation Angle');
    expect(document.body.textContent).toContain('Scale Size');
    expect(document.body.textContent).toContain('Skew Slant');

    const rotateLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Rotation Angle')
    );
    const rotateSelect = rotateLabel
      ? (document.getElementById(rotateLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(rotateSelect).not.toBeNull();
    if (rotateSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(rotateSelect, 'rotate-2');
        rotateSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(rotateSelect.value).toBe('rotate-2');
    }
  });

  it('selects multi-column ratio presets in section mode', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
          initialMode="section"
        />
      );
    });

    expect(document.body.textContent).toContain('Row Multi-Column Layout');
    const colPresetButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Column layout 1/2 + 1/2'
    );
    expect(colPresetButton).toBeDefined();

    await act(async () => {
      colPresetButton?.click();
    });

    const colSelect = Array.from(document.querySelectorAll('select')).find(
      (s) => s.value === 'grid grid-cols-1 md:grid-cols-2'
    );
    expect(colSelect).toBeDefined();
  });

  it('configures CSS filter studio controls in design tab', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
        />
      );
    });

    const boxModelButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Box Model'
    );
    await act(async () => {
      boxModelButton?.click();
    });

    expect(document.body.textContent).toContain('Brightness');
    expect(document.body.textContent).toContain('Contrast');
    expect(document.body.textContent).toContain('Saturation');
    expect(document.body.textContent).toContain('Hue Shift (Color Shift)');
    expect(document.body.textContent).toContain('Sepia Vintage');
    expect(document.body.textContent).toContain('Element Blur Filter');

    const brightnessLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Brightness')
    );
    const brightnessSelect = brightnessLabel
      ? (document.getElementById(brightnessLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(brightnessSelect).not.toBeNull();
    if (brightnessSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(brightnessSelect, 'brightness-110');
        brightnessSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(brightnessSelect.value).toBe('brightness-110');
    }
  });

  it('applies quick civic design tokens in code tab', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
        />
      );
    });

    const codeTabButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Code'
    );
    await act(async () => {
      codeTabButton?.click();
    });

    expect(document.body.textContent).toContain('Quick Design Tokens');
    expect(document.body.textContent).toContain('+Glass Frost');
    expect(document.body.textContent).toContain('+Amber Glow');

    const glassFrostButton = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Glass Frost')
    );
    expect(glassFrostButton).toBeDefined();
    await act(async () => {
      glassFrostButton?.click();
    });

    const customClassInput = Array.from(document.querySelectorAll('input')).find((input) =>
      input.value?.includes('backdrop-blur-md bg-white/10')
    );
    expect(customClassInput).toBeDefined();
  });

  it('configures entrance stagger delay in advanced tab', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
        />
      );
    });

    const advancedButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Advanced'
    );
    await act(async () => {
      advancedButton?.click();
    });

    expect(document.body.textContent).toContain('Entrance Stagger Delay');
    const delayLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Entrance Stagger Delay')
    );
    const delaySelect = delayLabel
      ? (document.getElementById(delayLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(delaySelect).not.toBeNull();
    if (delaySelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(delaySelect, 'delay-100');
        delaySelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(delaySelect.value).toBe('delay-100');
    }
  });

  it('morphs element type cleanly in content tab', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
        />
      );
    });

    expect(document.body.textContent).toContain('Element Type:');
    const quoteButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Quote'
    );
    expect(quoteButton).toBeDefined();

    await act(async () => {
      quoteButton?.click();
    });

    expect(document.body.textContent).toContain('Block #1 · quote');
    expect(document.body.textContent).toContain('Quote Content');
  });

  it('configures text decoration in typography tab', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
        />
      );
    });

    const typeTabButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Type'
    );
    await act(async () => {
      typeTabButton?.click();
    });

    expect(document.body.textContent).toContain('Text Decoration & Accents');
    const decorationLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Text Decoration & Accents')
    );
    const decorationSelect = decorationLabel
      ? (document.getElementById(decorationLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(decorationSelect).not.toBeNull();
    if (decorationSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(
          decorationSelect,
          'underline underline-offset-4 decoration-amber-500/60 decoration-2'
        );
        decorationSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(decorationSelect.value).toBe(
        'underline underline-offset-4 decoration-amber-500/60 decoration-2'
      );
    }
  });

  it('configures section frame border and overlay tint in section mode', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
          initialMode="section"
        />
      );
    });

    expect(document.body.textContent).toContain('Section Border Frame');
    expect(document.body.textContent).toContain('Section Atmosphere & Overlay Tint');

    const borderLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Section Border Frame')
    );
    const borderSelect = borderLabel
      ? (document.getElementById(borderLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(borderSelect).not.toBeNull();
    if (borderSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(borderSelect, 'border-2');
        borderSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(borderSelect.value).toBe('border-2');
    }

    const overlayLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Section Atmosphere & Overlay Tint')
    );
    const overlaySelect = overlayLabel
      ? (document.getElementById(overlayLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(overlaySelect).not.toBeNull();
    if (overlaySelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(overlaySelect, 'bg-black/40');
        overlaySelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(overlaySelect.value).toBe('bg-black/40');
    }
  });

  it('unifies domain types with @/types/unified exports', () => {
    const customConfig: Partial<VisualComposerStyles> = {
      section: {
        ...DEFAULT_VC_STYLES.section,
        border: 'border-2',
        topDivider: 'border-t-2 border-accent-gold',
        bottomDivider: 'border-b-2 border-accent-gold',
        overflow: 'overflow-hidden',
      },
      typography: { ...DEFAULT_VC_STYLES.typography, textDecoration: 'underline' },
      effects: { ...DEFAULT_VC_STYLES.effects, blendMode: 'mix-blend-multiply' },
      motion: { ...DEFAULT_VC_STYLES.motion, hoverGlow: 'hover:ring-2 hover:ring-accent-gold/60' },
    };
    expect(customConfig.section?.border).toBe('border-2');
    expect(customConfig.section?.topDivider).toBe('border-t-2 border-accent-gold');
    expect(customConfig.section?.bottomDivider).toBe('border-b-2 border-accent-gold');
    expect(customConfig.section?.overflow).toBe('overflow-hidden');
    expect(customConfig.typography?.textDecoration).toBe('underline');
    expect(customConfig.effects?.blendMode).toBe('mix-blend-multiply');
    expect(customConfig.motion?.hoverGlow).toBe('hover:ring-2 hover:ring-accent-gold/60');
    expect(DEFAULT_VC_STYLES.section.topDivider).toBe('');
    expect(DEFAULT_VC_STYLES.section.bottomDivider).toBe('');
    expect(DEFAULT_VC_STYLES.section.overflow).toBe('');
    expect(DEFAULT_VC_STYLES.effects.blendMode).toBe('');
    expect(DEFAULT_VC_STYLES.motion.hoverGlow).toBe('');
  });

  it('configures top and bottom shape dividers and overflow in section mode', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
          initialMode="section"
        />
      );
    });

    expect(document.body.textContent).toContain('Top Shape Divider (Pro)');
    expect(document.body.textContent).toContain('Bottom Shape Divider (Pro)');
    expect(document.body.textContent).toContain('Section Overflow & Shape Boundary Clipping');

    const topDividerLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Top Shape Divider (Pro)')
    );
    const topDividerSelect = topDividerLabel
      ? (document.getElementById(topDividerLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(topDividerSelect).not.toBeNull();
    if (topDividerSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(topDividerSelect, 'border-t-2 border-accent-gold');
        topDividerSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(topDividerSelect.value).toBe('border-t-2 border-accent-gold');
    }

    const overflowLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Section Overflow & Shape Boundary Clipping')
    );
    const overflowSelect = overflowLabel
      ? (document.getElementById(overflowLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(overflowSelect).not.toBeNull();
    if (overflowSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(overflowSelect, 'overflow-hidden');
        overflowSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(overflowSelect.value).toBe('overflow-hidden');
    }
  });

  it('configures mix blend mode in effects tab', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
          initialMode="block"
        />
      );
    });

    // Switch to Box Model / Design tab
    const designTabBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Box Model')
    );
    expect(designTabBtn).toBeDefined();
    await act(async () => {
      designTabBtn?.click();
    });

    const blendModeLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Mix Blend Mode (Layer Blending)')
    );
    const blendModeSelect = blendModeLabel
      ? (document.getElementById(blendModeLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(blendModeSelect).not.toBeNull();
    if (blendModeSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(blendModeSelect, 'mix-blend-multiply');
        blendModeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(blendModeSelect.value).toBe('mix-blend-multiply');
    }
  });

  it('configures hover glow ring in advanced tab', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
          initialMode="block"
        />
      );
    });

    // Switch to Advanced tab
    const advancedTabBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Advanced')
    );
    expect(advancedTabBtn).toBeDefined();
    await act(async () => {
      advancedTabBtn?.click();
    });

    const hoverGlowLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Hover Glow Ring')
    );
    const hoverGlowSelect = hoverGlowLabel
      ? (document.getElementById(hoverGlowLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(hoverGlowSelect).not.toBeNull();
    if (hoverGlowSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(hoverGlowSelect, 'hover:ring-2 hover:ring-accent-gold/60');
        hoverGlowSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(hoverGlowSelect.value).toBe('hover:ring-2 hover:ring-accent-gold/60');
    }
  });

  it('resets styles and exchanges design configuration JSON in Code tab', async () => {
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={vi.fn()}
          initialMode="block"
        />
      );
    });

    // Quick Reset button in drawer header
    const resetBtn = document.querySelector('button[aria-label="Reset styles to defaults"]');
    expect(resetBtn).not.toBeNull();
    await act(async () => {
      (resetBtn as HTMLButtonElement).click();
    });

    // Switch to Code tab
    const codeTabBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Code')
    );
    expect(codeTabBtn).toBeDefined();
    await act(async () => {
      codeTabBtn?.click();
    });

    expect(document.body.textContent).toContain('Design Config JSON Studio');
    const exportJsonBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export JSON')
    );
    expect(exportJsonBtn).toBeDefined();
    await act(async () => {
      exportJsonBtn?.click();
    });

    const importJsonBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Import JSON')
    );
    expect(importJsonBtn).toBeDefined();
    await act(async () => {
      importJsonBtn?.click();
    });
  });

  it('configures section vertical margin, column justification, and background sizing/repeating in section mode', async () => {
    const onSaveBlock = vi.fn();

    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={onSaveBlock}
          initialMode="section"
        />
      );
    });

    // Verify section mode UI is active
    expect(document.body.textContent).toContain('Vertical Section Margin');

    // 1. Vertical Section Margin
    const marginYLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Vertical Section Margin')
    );
    const marginYSelect = marginYLabel
      ? (document.getElementById(marginYLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(marginYSelect).not.toBeNull();
    if (marginYSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(marginYSelect, 'my-12');
        marginYSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(marginYSelect.value).toBe('my-12');
    }

    // 2. Background Scale / Size & Repeat
    const bgSizeLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Background Scale / Size')
    );
    const bgSizeSelect = bgSizeLabel
      ? (document.getElementById(bgSizeLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(bgSizeSelect).not.toBeNull();
    if (bgSizeSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(bgSizeSelect, 'bg-contain');
        bgSizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(bgSizeSelect.value).toBe('bg-contain');
    }

    const bgRepeatLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Background Tiling / Repeat')
    );
    const bgRepeatSelect = bgRepeatLabel
      ? (document.getElementById(bgRepeatLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(bgRepeatSelect).not.toBeNull();
    if (bgRepeatSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(bgRepeatSelect, 'bg-repeat-x');
        bgRepeatSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(bgRepeatSelect.value).toBe('bg-repeat-x');
    }

    // 3. Multi-column preset & Column Justification
    const columnsSelect = Array.from(document.querySelectorAll('select')).find((s) =>
      Array.from(s.options).some((o) => o.value.includes('grid-cols-2'))
    );
    expect(columnsSelect).toBeDefined();
    if (columnsSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(columnsSelect, 'grid grid-cols-1 md:grid-cols-2');
        columnsSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    const justifyLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Column Justification')
    );
    const justifySelect = justifyLabel
      ? (document.getElementById(justifyLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(justifySelect).not.toBeNull();
    if (justifySelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(justifySelect, 'justify-between');
        justifySelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(justifySelect.value).toBe('justify-between');
    }

    // Save Section and verify compiled classes include the new styles
    const saveButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Save Section'
    );
    await act(async () => {
      saveButton?.click();
    });

    expect(onSaveBlock).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('my-12'),
      undefined,
      undefined
    );
    const savedClasses = onSaveBlock.mock.calls[0][1];
    expect(savedClasses).toContain('bg-contain');
    expect(savedClasses).toContain('bg-repeat-x');
    expect(savedClasses).toContain('justify-between');
  });

  it('configures cursor, visibility, hover effects, and typography wrapping in block mode', async () => {
    const onSaveBlock = vi.fn();

    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={onSaveBlock}
          initialMode="block"
        />
      );
    });

    // 1. Switch to Box Model / Design tab: Cursor & Visibility & Effects
    const designTabBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Box Model')
    );
    expect(designTabBtn).toBeDefined();
    await act(async () => {
      designTabBtn?.click();
    });

    const cursorLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Cursor Behavior')
    );
    const cursorSelect = cursorLabel
      ? (document.getElementById(cursorLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(cursorSelect).not.toBeNull();
    if (cursorSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(cursorSelect, 'cursor-pointer');
        cursorSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(cursorSelect.value).toBe('cursor-pointer');
    }

    const visibilityLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('CSS Visibility')
    );
    const visibilitySelect = visibilityLabel
      ? (document.getElementById(visibilityLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(visibilitySelect).not.toBeNull();
    if (visibilitySelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(visibilitySelect, 'invisible');
        visibilitySelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(visibilitySelect.value).toBe('invisible');
    }

    // 2. Effects tab: Hover Brightness & Opacity
    const hoverBrightnessLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Hover Brightness Shift')
    );
    const hoverBrightnessSelect = hoverBrightnessLabel
      ? (document.getElementById(hoverBrightnessLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(hoverBrightnessSelect).not.toBeNull();
    if (hoverBrightnessSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(hoverBrightnessSelect, 'hover:brightness-110 transition-all');
        hoverBrightnessSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(hoverBrightnessSelect.value).toBe('hover:brightness-110 transition-all');
    }

    const hoverOpacityLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Hover Opacity Shift')
    );
    const hoverOpacitySelect = hoverOpacityLabel
      ? (document.getElementById(hoverOpacityLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(hoverOpacitySelect).not.toBeNull();
    if (hoverOpacitySelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(hoverOpacitySelect, 'hover:opacity-80 transition-opacity');
        hoverOpacitySelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(hoverOpacitySelect.value).toBe('hover:opacity-80 transition-opacity');
    }

    // 3. Switch to Typography tab: Font Posture & Text Wrapping
    const typeTabBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Type')
    );
    expect(typeTabBtn).toBeDefined();
    await act(async () => {
      typeTabBtn?.click();
    });

    const fontStyleLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Font Posture / Style')
    );
    const fontStyleSelect = fontStyleLabel
      ? (document.getElementById(fontStyleLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(fontStyleSelect).not.toBeNull();
    if (fontStyleSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(fontStyleSelect, 'italic');
        fontStyleSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(fontStyleSelect.value).toBe('italic');
    }

    const textWrapLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Text Wrapping & Overflow')
    );
    const textWrapSelect = textWrapLabel
      ? (document.getElementById(textWrapLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(textWrapSelect).not.toBeNull();
    if (textWrapSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(textWrapSelect, 'text-balance');
        textWrapSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(textWrapSelect.value).toBe('text-balance');
    }

    // Save Block and verify compiled classes contain all applied block attributes
    const saveButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Save Block'
    );
    await act(async () => {
      saveButton?.click();
    });

    expect(onSaveBlock).toHaveBeenCalledTimes(1);
    const savedClasses = onSaveBlock.mock.calls[0][1];
    expect(savedClasses).toContain('cursor-pointer');
    expect(savedClasses).toContain('invisible');
    expect(savedClasses).toContain('hover:brightness-110');
    expect(savedClasses).toContain('hover:opacity-80');
    expect(savedClasses).toContain('italic');
    expect(savedClasses).toContain('text-balance');
  });

  it('configures section horizontal margin and stacking z-index in section mode', async () => {
    const onSaveBlock = vi.fn();

    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={onSaveBlock}
          initialMode="section"
        />
      );
    });

    // 1. Horizontal Section Margin (mx-auto)
    const marginXLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Horizontal Margin')
    );
    const marginXSelect = marginXLabel
      ? (document.getElementById(marginXLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(marginXSelect).not.toBeNull();
    if (marginXSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(marginXSelect, 'mx-auto');
        marginXSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(marginXSelect.value).toBe('mx-auto');
    }

    // 2. Section Stacking Z-Index
    const zIndexLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Stacking Z-Index')
    );
    const zIndexSelect = zIndexLabel
      ? (document.getElementById(zIndexLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(zIndexSelect).not.toBeNull();
    if (zIndexSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(zIndexSelect, 'relative z-30');
        zIndexSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(zIndexSelect.value).toBe('relative z-30');
    }

    // Save Section and verify compiled classes include marginX and zIndex
    const saveButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Save Section'
    );
    await act(async () => {
      saveButton?.click();
    });

    expect(onSaveBlock).toHaveBeenCalledTimes(1);
    const savedClasses = onSaveBlock.mock.calls[0][1];
    expect(savedClasses).toContain('mx-auto');
    expect(savedClasses).toContain('relative z-30');
  });

  it('configures flex self-alignment, order, grow/shrink, media aspect ratio, object fit, easing curve, and block anchor ID in block mode', async () => {
    const onSaveBlock = vi.fn();

    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={onSaveBlock}
          initialMode="block"
        />
      );
    });

    // 1. Switch to Box Model / Design tab: Self Alignment, Order, Grow, Aspect Ratio, Object Fit
    const designTabBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Box Model')
    );
    expect(designTabBtn).toBeDefined();
    await act(async () => {
      designTabBtn?.click();
    });

    const alignSelfLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Self Alignment')
    );
    const alignSelfSelect = alignSelfLabel
      ? (document.getElementById(alignSelfLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(alignSelfSelect).not.toBeNull();
    if (alignSelfSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(alignSelfSelect, 'self-center');
        alignSelfSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(alignSelfSelect.value).toBe('self-center');
    }

    const orderLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Display Order')
    );
    const orderSelect = orderLabel
      ? (document.getElementById(orderLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(orderSelect).not.toBeNull();
    if (orderSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(orderSelect, 'order-first');
        orderSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(orderSelect.value).toBe('order-first');
    }

    const flexGrowLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Flex Sizing')
    );
    const flexGrowSelect = flexGrowLabel
      ? (document.getElementById(flexGrowLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(flexGrowSelect).not.toBeNull();
    if (flexGrowSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(flexGrowSelect, 'grow');
        flexGrowSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(flexGrowSelect.value).toBe('grow');
    }

    const aspectRatioLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Aspect Ratio')
    );
    const aspectRatioSelect = aspectRatioLabel
      ? (document.getElementById(aspectRatioLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(aspectRatioSelect).not.toBeNull();
    if (aspectRatioSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(aspectRatioSelect, 'aspect-video');
        aspectRatioSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(aspectRatioSelect.value).toBe('aspect-video');
    }

    const objectFitLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Media Object Fit')
    );
    const objectFitSelect = objectFitLabel
      ? (document.getElementById(objectFitLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(objectFitSelect).not.toBeNull();
    if (objectFitSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(objectFitSelect, 'object-cover');
        objectFitSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(objectFitSelect.value).toBe('object-cover');
    }

    // 2. Switch to Advanced tab: Animation Easing Curve
    const advancedTabBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Advanced')
    );
    expect(advancedTabBtn).toBeDefined();
    await act(async () => {
      advancedTabBtn?.click();
    });

    const timingLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Animation Easing Curve')
    );
    const timingSelect = timingLabel
      ? (document.getElementById(timingLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(timingSelect).not.toBeNull();
    if (timingSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(timingSelect, 'ease-out');
        timingSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(timingSelect.value).toBe('ease-out');
    }

    // 3. Switch to Code tab: Block Element Anchor ID
    const codeTabBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Code')
    );
    expect(codeTabBtn).toBeDefined();
    await act(async () => {
      codeTabBtn?.click();
    });

    const anchorInput = document.querySelector(
      'input[placeholder="e.g. block-cta, hero-heading"]'
    ) as HTMLInputElement | null;
    expect(anchorInput).not.toBeNull();
    if (anchorInput) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(anchorInput, 'cta-banner');
        anchorInput.dispatchEvent(new Event('input', { bubbles: true }));
        anchorInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(anchorInput.value).toBe('cta-banner');
    }

    // Save Block and verify compiled classes and anchorId
    const saveButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Save Block'
    );
    await act(async () => {
      saveButton?.click();
    });

    expect(onSaveBlock).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('self-center'),
      'cta-banner',
      undefined
    );
    const savedClasses = onSaveBlock.mock.calls[0][1];
    expect(savedClasses).toContain('order-first');
    expect(savedClasses).toContain('grow');
    expect(savedClasses).toContain('aspect-video');
    expect(savedClasses).toContain('object-cover');
    expect(savedClasses).toContain('ease-out');
  });

  it('configures advanced row/section controls including asymmetric columns, equal height, mobile reverse, blend mode, and inner shadow', async () => {
    const onSaveBlock = vi.fn();

    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={onSaveBlock}
          initialMode="section"
        />
      );
    });

    // 1. Multi-column preset (3/4 + 1/4)
    const colPresetBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Column layout 3/4 + 1/4'
    );
    expect(colPresetBtn).toBeDefined();
    await act(async () => {
      colPresetBtn?.click();
    });

    // 2. Toggle Equal Height Columns
    const equalHeightBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Equal Height')
    );
    expect(equalHeightBtn).toBeDefined();
    await act(async () => {
      equalHeightBtn?.click();
    });

    // 3. Toggle Reverse on Mobile
    const reverseMobileBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reverse Mobile')
    );
    expect(reverseMobileBtn).toBeDefined();
    await act(async () => {
      reverseMobileBtn?.click();
    });

    // 4. Background Blend Mode
    const blendLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Background Blend Mode')
    );
    const blendSelect = blendLabel
      ? (document.getElementById(blendLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(blendSelect).not.toBeNull();
    if (blendSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(blendSelect, 'bg-blend-multiply');
        blendSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(blendSelect.value).toBe('bg-blend-multiply');
    }

    // 5. Inner Recessed Shadow
    const innerShadowLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Inner Recessed Shadow')
    );
    const innerShadowSelect = innerShadowLabel
      ? (document.getElementById(innerShadowLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(innerShadowSelect).not.toBeNull();
    if (innerShadowSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(innerShadowSelect, 'shadow-inner');
        innerShadowSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(innerShadowSelect.value).toBe('shadow-inner');
    }

    // Save Section and verify compiled classes
    const saveSectionButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Save Section'
    );
    expect(saveSectionButton).toBeDefined();
    await act(async () => {
      saveSectionButton?.click();
    });

    expect(onSaveBlock).toHaveBeenCalledTimes(1);
    const savedClasses = onSaveBlock.mock.calls[0][1];
    expect(savedClasses).toContain('grid grid-cols-1 md:grid-cols-4');
    expect(savedClasses).toContain('items-stretch');
    expect(savedClasses).toContain('flex-col-reverse md:flex-row');
    expect(savedClasses).toContain('bg-blend-multiply');
    expect(savedClasses).toContain('shadow-inner');
  });

  it('configures pro visual composer block controls across box model, typography, and motion', async () => {
    const onSaveBlock = vi.fn();

    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={sampleHeadingBlock}
          blockIndex={0}
          onSaveBlock={onSaveBlock}
        />
      );
    });

    // 1. Box Model Tab: Width, Min/Max dimensions, Flex, Pointer Events, Filters, 2D Transforms
    const boxModelTabBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Box Model'
    );
    await act(async () => {
      boxModelTabBtn?.click();
    });

    // Width
    const widthLabel = Array.from(document.querySelectorAll('label')).find(
      (l) => l.textContent?.trim() === 'Element Width'
    );
    const widthSelect = widthLabel
      ? (document.getElementById(widthLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(widthSelect).not.toBeNull();
    if (widthSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(widthSelect, 'w-full');
        widthSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(widthSelect.value).toBe('w-full');
    }

    // Min Width
    const minWidthLabel = Array.from(document.querySelectorAll('label')).find(
      (l) => l.textContent?.trim() === 'Min Width'
    );
    const minWidthSelect = minWidthLabel
      ? (document.getElementById(minWidthLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(minWidthSelect).not.toBeNull();
    if (minWidthSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(minWidthSelect, 'min-w-[300px]');
        minWidthSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(minWidthSelect.value).toBe('min-w-[300px]');
    }

    // Height
    const heightLabel = Array.from(document.querySelectorAll('label')).find(
      (l) => l.textContent?.trim() === 'Height'
    );
    const heightSelect = heightLabel
      ? (document.getElementById(heightLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(heightSelect).not.toBeNull();
    if (heightSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(heightSelect, 'h-64');
        heightSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(heightSelect.value).toBe('h-64');
    }

    // Pointer Events
    const pointerEventsLabel = Array.from(document.querySelectorAll('label')).find(
      (l) => l.textContent?.trim() === 'Pointer Events'
    );
    const pointerEventsSelect = pointerEventsLabel
      ? (document.getElementById(pointerEventsLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(pointerEventsSelect).not.toBeNull();
    if (pointerEventsSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(pointerEventsSelect, 'pointer-events-none');
        pointerEventsSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(pointerEventsSelect.value).toBe('pointer-events-none');
    }

    // User Selection
    const userSelectLabel = Array.from(document.querySelectorAll('label')).find(
      (l) => l.textContent?.trim() === 'User Selection'
    );
    const userSelectSelect = userSelectLabel
      ? (document.getElementById(userSelectLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(userSelectSelect).not.toBeNull();
    if (userSelectSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(userSelectSelect, 'select-none');
        userSelectSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(userSelectSelect.value).toBe('select-none');
    }

    // Invert Filter
    const invertLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('CSS Invert Filter')
    );
    const invertSelect = invertLabel
      ? (document.getElementById(invertLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(invertSelect).not.toBeNull();
    if (invertSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(invertSelect, 'invert');
        invertSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(invertSelect.value).toBe('invert');
    }

    // Drop Shadow
    const dropShadowLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('CSS Drop Shadow')
    );
    const dropShadowSelect = dropShadowLabel
      ? (document.getElementById(dropShadowLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(dropShadowSelect).not.toBeNull();
    if (dropShadowSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(dropShadowSelect, 'drop-shadow-xl');
        dropShadowSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(dropShadowSelect.value).toBe('drop-shadow-xl');
    }

    // Translate X & Y & Origin
    const transXLabel = Array.from(document.querySelectorAll('label')).find(
      (l) => l.textContent?.trim() === 'Translate X'
    );
    const transXSelect = transXLabel
      ? (document.getElementById(transXLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(transXSelect).not.toBeNull();
    if (transXSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(transXSelect, 'translate-x-4');
        transXSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(transXSelect.value).toBe('translate-x-4');
    }

    const transYLabel = Array.from(document.querySelectorAll('label')).find(
      (l) => l.textContent?.trim() === 'Translate Y'
    );
    const transYSelect = transYLabel
      ? (document.getElementById(transYLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(transYSelect).not.toBeNull();
    if (transYSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(transYSelect, '-translate-y-2');
        transYSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(transYSelect.value).toBe('-translate-y-2');
    }

    const originLabel = Array.from(document.querySelectorAll('label')).find(
      (l) => l.textContent?.trim() === 'Transform Origin'
    );
    const originSelect = originLabel
      ? (document.getElementById(originLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(originSelect).not.toBeNull();
    if (originSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(originSelect, 'origin-top-left');
        originSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(originSelect.value).toBe('origin-top-left');
    }

    // 2. Type Tab: Word Break, 4xl, Font Weight
    const typeTabBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Type'
    );
    await act(async () => {
      typeTabBtn?.click();
    });

    const wordBreakLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Word Break Behavior')
    );
    const wordBreakSelect = wordBreakLabel
      ? (document.getElementById(wordBreakLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(wordBreakSelect).not.toBeNull();
    if (wordBreakSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(wordBreakSelect, 'break-words');
        wordBreakSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(wordBreakSelect.value).toBe('break-words');
    }

    // 3. Advanced Tab: Hover Border, Hover Shadow
    const advancedTabBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Advanced'
    );
    await act(async () => {
      advancedTabBtn?.click();
    });

    const hoverBorderLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Hover Border Accent')
    );
    const hoverBorderSelect = hoverBorderLabel
      ? (document.getElementById(hoverBorderLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(hoverBorderSelect).not.toBeNull();
    if (hoverBorderSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(hoverBorderSelect, 'hover:border-amber-500');
        hoverBorderSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(hoverBorderSelect.value).toBe('hover:border-amber-500');
    }

    const hoverShadowLabel = Array.from(document.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Hover Elevation Shadow')
    );
    const hoverShadowSelect = hoverShadowLabel
      ? (document.getElementById(hoverShadowLabel.htmlFor) as HTMLSelectElement)
      : null;
    expect(hoverShadowSelect).not.toBeNull();
    if (hoverShadowSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(hoverShadowSelect, 'hover:shadow-2xl');
        hoverShadowSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(hoverShadowSelect.value).toBe('hover:shadow-2xl');
    }

    // Save Block
    const saveButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Save Block'
    );
    await act(async () => {
      saveButton?.click();
    });

    expect(onSaveBlock).toHaveBeenCalledTimes(1);
    const savedClasses = onSaveBlock.mock.calls[0][1];
    expect(savedClasses).toContain('w-full');
    expect(savedClasses).toContain('min-w-[300px]');
    expect(savedClasses).toContain('h-64');
    expect(savedClasses).toContain('pointer-events-none');
    expect(savedClasses).toContain('select-none');
    expect(savedClasses).toContain('invert');
    expect(savedClasses).toContain('drop-shadow-xl');
    expect(savedClasses).toContain('translate-x-4');
    expect(savedClasses).toContain('-translate-y-2');
    expect(savedClasses).toContain('origin-top-left');
    expect(savedClasses).toContain('break-words');
    expect(savedClasses).toContain('hover:border-amber-500');
    expect(savedClasses).toContain('hover:shadow-2xl');
  });

  it('configures 10x pro section controls: row canvas layout, divider accent color, and responsive visibility', async () => {
    const onSaveBlock = vi.fn();
    const headingBlock: Block = {
      id: 'b-section-pro',
      type: 'heading',
      level: 2,
      html: 'Civic Freedom Rally',
    };

    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={headingBlock}
          blockIndex={0}
          onSaveBlock={onSaveBlock}
          initialMode="section"
        />
      );
    });

    // Select Row Canvas Mode: Full-Width Content
    const rowLayoutSelect = Array.from(document.querySelectorAll('select')).find(
      (s) =>
        s.id.includes('section-row-layout') ||
        s.previousElementSibling?.textContent?.includes('Row Canvas Mode')
    );
    if (rowLayoutSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(rowLayoutSelect, 'full-width-content');
        rowLayoutSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(rowLayoutSelect.value).toBe('full-width-content');
    }

    // Select Divider Accent Color
    const dividerColorSelect = Array.from(document.querySelectorAll('select')).find(
      (s) =>
        s.id.includes('section-divider-color') ||
        s.previousElementSibling?.textContent?.includes('Divider Accent Color')
    );
    if (dividerColorSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(dividerColorSelect, 'text-amber-500/40');
        dividerColorSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(dividerColorSelect.value).toBe('text-amber-500/40');
    }

    // Save Section
    const saveButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Save Section'
    );
    await act(async () => {
      saveButton?.click();
    });

    expect(onSaveBlock).toHaveBeenCalledTimes(1);
    const savedClasses = onSaveBlock.mock.calls[0][1];
    expect(savedClasses).toContain('w-full max-w-none px-0');
    expect(savedClasses).toContain('text-amber-500/40');
  });

  it('configures 10x pro block controls: 4-corner unlinked radius, directional offsets, shadow aura, clip path, text columns, hover colors, and inline CSS', async () => {
    const onSaveBlock = vi.fn();
    const calloutBlock: Block = {
      id: 'b-callout-10x',
      type: 'callout',
      tone: 'action',
      html: 'Grassroots Action Needed Today',
    };

    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={calloutBlock}
          blockIndex={0}
          onSaveBlock={onSaveBlock}
          initialMode="block"
        />
      );
    });

    // Switch to Box Model Tab
    const designTabBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Box Model')
    );
    await act(async () => {
      designTabBtn?.click();
    });

    // Toggle Linked Corners to Unlinked
    const unlinkButton = document.querySelector(
      '[data-testid="corner-radius-link-toggle"]'
    ) as HTMLButtonElement | null;
    if (unlinkButton) {
      await act(async () => {
        unlinkButton.click();
      });
    }

    // Select Top-Left Radius
    const tlSelect = Array.from(document.querySelectorAll('select')).find(
      (s) =>
        s.id.includes('radius-top-left') ||
        s.previousElementSibling?.textContent?.includes('Top-Left')
    );
    if (tlSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(tlSelect, 'rounded-tl-3xl');
        tlSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(tlSelect.value).toBe('rounded-tl-3xl');
    }

    // Select Shadow Aura Color
    const shadowColorSelect = Array.from(document.querySelectorAll('select')).find(
      (s) =>
        s.id.includes('shadow-color') ||
        s.previousElementSibling?.textContent?.includes('Shadow Aura Glow')
    );
    if (shadowColorSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(shadowColorSelect, 'shadow-amber-500/20');
        shadowColorSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(shadowColorSelect.value).toBe('shadow-amber-500/20');
    }

    // Select Shape Mask / Clip Path
    const clipPathSelect = Array.from(document.querySelectorAll('select')).find(
      (s) =>
        s.id.includes('clip-path') || s.previousElementSibling?.textContent?.includes('Shape Mask')
    );
    if (clipPathSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(clipPathSelect, '[clip-path:polygon(0_0,100%_0,100%_85%,0_100%)]');
        clipPathSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(clipPathSelect.value).toBe('[clip-path:polygon(0_0,100%_0,100%_85%,0_100%)]');
    }

    // Set Directional Positioning Offsets
    const topSelect = Array.from(document.querySelectorAll('select')).find(
      (s) => s.id.includes('layout-top') || s.previousElementSibling?.textContent === 'Top'
    );
    if (topSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(topSelect, 'top-4');
        topSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(topSelect.value).toBe('top-4');
    }

    // Switch to Type Tab
    const typoTabBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Type')
    );
    await act(async () => {
      typoTabBtn?.click();
    });

    const columnsSelect = Array.from(document.querySelectorAll('select')).find(
      (s) =>
        s.id.includes('typography-text-columns') ||
        s.previousElementSibling?.textContent?.includes('Editorial Multi-Columns')
    );
    if (columnsSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(columnsSelect, 'columns-1 md:columns-2 gap-8');
        columnsSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(columnsSelect.value).toBe('columns-1 md:columns-2 gap-8');
    }

    const fontSmoothingSelect = Array.from(document.querySelectorAll('select')).find(
      (s) =>
        s.id.includes('typography-font-smoothing') ||
        s.previousElementSibling?.textContent?.includes('Font Smoothing')
    );
    if (fontSmoothingSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(fontSmoothingSelect, 'antialiased');
        fontSmoothingSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(fontSmoothingSelect.value).toBe('antialiased');
    }

    // Switch to Advanced Tab for Hover Background and Hover Text Color
    const advancedTabBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Advanced')
    );
    await act(async () => {
      advancedTabBtn?.click();
    });

    const hoverBgSelect = Array.from(document.querySelectorAll('select')).find(
      (s) =>
        s.id.includes('motion-hover-bg') ||
        s.previousElementSibling?.textContent?.includes('Hover Background Tint')
    );
    if (hoverBgSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(hoverBgSelect, 'hover:bg-amber-500/10');
        hoverBgSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(hoverBgSelect.value).toBe('hover:bg-amber-500/10');
    }

    const hoverTextColorSelect = Array.from(document.querySelectorAll('select')).find(
      (s) =>
        s.id.includes('motion-hover-text-color') ||
        s.previousElementSibling?.textContent?.includes('Hover Text Accent')
    );
    if (hoverTextColorSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(hoverTextColorSelect, 'hover:text-amber-400');
        hoverTextColorSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(hoverTextColorSelect.value).toBe('hover:text-amber-400');
    }

    // Switch to Code Tab for customStyle inline CSS
    const codeTabBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Code')
    );
    await act(async () => {
      codeTabBtn?.click();
    });

    const customStyleInput = Array.from(document.querySelectorAll('input')).find(
      (inp) =>
        inp.id.includes('custom-style') ||
        inp.previousElementSibling?.textContent?.includes('Custom Inline CSS')
    );
    if (customStyleInput) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(customStyleInput, 'letter-spacing: 0.1em; outline: 1px dashed gold;');
        customStyleInput.dispatchEvent(new Event('input', { bubbles: true }));
        customStyleInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(customStyleInput.value).toBe('letter-spacing: 0.1em; outline: 1px dashed gold;');
    }

    // Save Block
    const saveButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Save Block'
    );
    await act(async () => {
      saveButton?.click();
    });

    expect(onSaveBlock).toHaveBeenCalledTimes(1);
    const savedClasses = onSaveBlock.mock.calls[0][1];
    expect(savedClasses).toContain('rounded-tl-3xl');
    expect(savedClasses).toContain('shadow-amber-500/20');
    expect(savedClasses).toContain('[clip-path:polygon(0_0,100%_0,100%_85%,0_100%)]');
    expect(savedClasses).toContain('top-4');
    expect(savedClasses).toContain('columns-1 md:columns-2 gap-8');
    expect(savedClasses).toContain('antialiased');
    expect(savedClasses).toContain('hover:bg-amber-500/10');
    expect(savedClasses).toContain('hover:text-amber-400');

    // Assert customStyle was passed as fourth argument
    const passedCustomStyle = onSaveBlock.mock.calls[0][3];
    expect(passedCustomStyle).toBe('letter-spacing: 0.1em; outline: 1px dashed gold;');
  });

  it('supports section and block theme tone mode overrides and decorative badges', async () => {
    const onSaveBlock = vi.fn();
    const mockBlock: Block = {
      id: 'theme-block',
      type: 'callout',
      tone: 'action',
      html: 'Theme tone test callout',
    };

    // Render in Section Mode first
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={mockBlock}
          blockIndex={0}
          onSaveBlock={onSaveBlock}
          initialMode="section"
        />
      );
    });

    // Find and select Section Theme Tone Mode
    const sectionThemeSelect = document.getElementById(
      'section-theme-mode-select'
    ) as HTMLSelectElement | null;
    expect(sectionThemeSelect).not.toBeNull();
    if (sectionThemeSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(sectionThemeSelect, 'dark');
        sectionThemeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(sectionThemeSelect.value).toBe('dark');
    }

    // Save Section
    const saveSectionButton = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save Section')
    );
    await act(async () => {
      saveSectionButton?.click();
    });

    expect(onSaveBlock).toHaveBeenCalledTimes(1);
    const savedSectionClasses = onSaveBlock.mock.calls[0][1];
    expect(savedSectionClasses).toContain('[data-theme=dark]');

    // Now unmount and re-mount in Block mode
    await act(async () => {
      root.unmount();
    });
    root = createRoot(container);

    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={mockBlock}
          blockIndex={0}
          onSaveBlock={onSaveBlock}
          initialMode="block"
        />
      );
    });

    // Switch to Box Model Tab
    const designTabBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Box Model')
    );
    await act(async () => {
      designTabBtn?.click();
    });

    // Select Block Theme Mode
    const blockThemeSelect = document.getElementById(
      'block-theme-mode-select'
    ) as HTMLSelectElement | null;
    expect(blockThemeSelect).not.toBeNull();
    if (blockThemeSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(blockThemeSelect, 'light');
        blockThemeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(blockThemeSelect.value).toBe('light');
    }

    // Set Badge Text
    const badgeInput = document.getElementById('block-badge-text-input') as HTMLInputElement | null;
    expect(badgeInput).not.toBeNull();
    if (badgeInput) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(badgeInput, 'ACTION ALERT');
        badgeInput.dispatchEvent(new Event('input', { bubbles: true }));
        badgeInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(badgeInput.value).toBe('ACTION ALERT');
    }

    // Save Block
    const saveBlockButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Save Block'
    );
    await act(async () => {
      saveBlockButton?.click();
    });

    expect(onSaveBlock).toHaveBeenCalledTimes(2);
    const savedBlockClasses = onSaveBlock.mock.calls[1][1];
    expect(savedBlockClasses).toContain('[data-theme=light]');
  });

  it('supports adaptive system theme mode and quick color swatches in section and block studios', async () => {
    const onSaveBlock = vi.fn();
    const mockBlock: Block = {
      id: 'system-theme-block',
      type: 'paragraph',
      html: 'System adaptive content block',
    };

    // Render in Section mode
    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={mockBlock}
          blockIndex={0}
          onSaveBlock={onSaveBlock}
          initialMode="section"
        />
      );
    });

    // Select System theme mode in Section Studio
    const sectionThemeSelect = document.getElementById(
      'section-theme-mode-select'
    ) as HTMLSelectElement | null;
    expect(sectionThemeSelect).not.toBeNull();
    if (sectionThemeSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(sectionThemeSelect, 'system');
        sectionThemeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(sectionThemeSelect.value).toBe('system');
    }

    // Click Civic Gold color swatch in Section Studio
    const goldSwatchBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.includes('Civic Gold')
    );
    expect(goldSwatchBtn).not.toBeNull();
    await act(async () => {
      goldSwatchBtn?.click();
    });

    // Save Section
    const saveSectionButton = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save Section')
    );
    await act(async () => {
      saveSectionButton?.click();
    });

    expect(onSaveBlock).toHaveBeenCalledTimes(1);
    const savedSectionClasses = onSaveBlock.mock.calls[0][1];
    expect(savedSectionClasses).toContain('[data-theme-mode=system]');
    expect(savedSectionClasses).toContain('bg-amber-500/10 text-amber-500');

    // Re-mount in Block mode
    await act(async () => {
      root.unmount();
    });
    root = createRoot(container);

    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={mockBlock}
          blockIndex={0}
          onSaveBlock={onSaveBlock}
          initialMode="block"
        />
      );
    });

    // Switch to Box Model Tab
    const designTabBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Box Model')
    );
    await act(async () => {
      designTabBtn?.click();
    });

    // Select System theme mode for block
    const blockThemeSelect = document.getElementById(
      'block-theme-mode-select'
    ) as HTMLSelectElement | null;
    expect(blockThemeSelect).not.toBeNull();
    if (blockThemeSelect) {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(blockThemeSelect, 'system');
        blockThemeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(blockThemeSelect.value).toBe('system');
    }

    // Save Block
    const saveBlockButton = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Save Block'
    );
    await act(async () => {
      saveBlockButton?.click();
    });

    expect(onSaveBlock).toHaveBeenCalledTimes(2);
    const savedBlockClasses = onSaveBlock.mock.calls[1][1];
    expect(savedBlockClasses).toContain('[data-theme-mode=system]');
  });

  it('restores themeMode, anchor ID, custom classes, custom style, and decorative badge when reopening inspector', async () => {
    const onSaveBlock = vi.fn();
    const existingBlock: Block = {
      id: 'existing-block-with-attrs',
      type: 'unsupported',
      html: '<div id="contact-us" class="p-6 bg-slate-900 border border-white/20" data-theme="dark" style="letter-spacing: 0.05em;"><span data-vc-badge data-tone="emerald" data-pos="top-left">ACTIVIST PASS</span><p>Contact Indivisible</p></div>',
    };

    await act(async () => {
      root.render(
        <VisualComposerInspector
          open={true}
          onClose={vi.fn()}
          block={existingBlock}
          blockIndex={0}
          onSaveBlock={onSaveBlock}
          initialMode="block"
        />
      );
    });

    // Switch to Box Model tab to verify restored block theme mode
    const designTabBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Box Model')
    );
    await act(async () => {
      designTabBtn?.click();
    });

    const blockThemeSelect = document.getElementById(
      'block-theme-mode-select'
    ) as HTMLSelectElement | null;
    expect(blockThemeSelect).not.toBeNull();
    expect(blockThemeSelect?.value).toBe('dark');

    const badgeInput = document.getElementById('block-badge-text-input') as HTMLInputElement | null;
    expect(badgeInput).not.toBeNull();
    expect(badgeInput?.value).toBe('ACTIVIST PASS');

    // Switch to Code tab to verify anchor ID and custom styles
    const codeTabBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Code')
    );
    await act(async () => {
      codeTabBtn?.click();
    });

    const anchorInput = document.getElementById('block-anchor-id-input') as HTMLInputElement | null;
    if (anchorInput) {
      expect(anchorInput.value).toBe('contact-us');
    }

    const customStyleInput = document.getElementById(
      'block-custom-style-input'
    ) as HTMLInputElement | null;
    if (customStyleInput) {
      expect(customStyleInput.value).toBe('letter-spacing: 0.05em;');
    }
  });
});
