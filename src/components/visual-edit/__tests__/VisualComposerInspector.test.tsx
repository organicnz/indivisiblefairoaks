// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisualComposerInspector } from '@/components/visual-edit/VisualComposerInspector';
import type { Block } from '@/lib/blocks';

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
});
