// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { parseBodyToBlocks, serializeBlocksToBody } from '@/components/admin/crm/composer/parser';
import { CAMPAIGN_TEMPLATES } from '@/components/admin/crm/composer/templates';
import { VisualComposerCanvas } from '@/components/admin/crm/composer/VisualComposerCanvas';
import type { ComposerBlock } from '@/types/crm';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Visual Composer parser & templates', () => {
  it('serializes and parses blocks with high fidelity across all 12 block types', () => {
    const blocks: ComposerBlock[] = [
      {
        id: 'b1',
        type: 'header',
        eyebrow: 'RALLY ALERT',
        heading: 'Stand Up For Democracy',
        level: 1,
      },
      {
        id: 'b2',
        type: 'text',
        content: 'Join fellow activists this Saturday at Carmichael Park.',
      },
      {
        id: 'b_img',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c',
        alt: 'Rally banner photo',
        caption: 'Over 200 neighbors in attendance',
        linkUrl: 'https://indivisiblefairoaks.org/actions',
        alignment: 'center',
      },
      {
        id: 'b_quote',
        type: 'quote',
        quote: 'Grassroots democracy is our strongest defense.',
        author: 'Elena Rostova',
        role: 'Carmichael Organizer',
      },
      {
        id: 'b_stat',
        type: 'stat',
        value: '1,450',
        label: 'Voters Mobilized',
        description: 'Across CA-06 in 2026',
        variant: 'primary',
      },
      {
        id: 'b_list',
        type: 'list',
        style: 'bullet',
        items: ['Arrive at 10 AM', 'Bring water and signs', 'Pick up voter guide'],
      },
      {
        id: 'b3',
        type: 'callout',
        variant: 'alert',
        title: 'Bring Signs',
        text: 'Handmade signs are strongly encouraged!',
      },
      {
        id: 'b4',
        type: 'button',
        label: 'RSVP Now',
        url: 'https://indivisiblefairoaks.org/actions',
        variant: 'primary',
      },
      {
        id: 'b5',
        type: 'event',
        title: 'Emergency Demonstration',
        date: 'Saturday, Oct 14',
        time: '10am',
        location: 'Carmichael Park',
        rsvpUrl: 'https://indivisiblefairoaks.org/actions',
      },
      {
        id: 'b_soc',
        type: 'social',
        heading: 'Connect & Mobilize',
        channels: [
          { platform: 'website', url: 'https://indivisiblefairoaks.org', label: 'Website' },
          { platform: 'actblue', url: 'https://indivisiblefairoaks.org/donate', label: 'Donate' },
        ],
      },
      {
        id: 'b6',
        type: 'divider',
      },
      {
        id: 'b7',
        type: 'signoff',
        closing: 'In solidarity,',
        sender: 'Indivisible Fair Oaks',
      },
    ];

    const bodyText = serializeBlocksToBody(blocks);
    expect(bodyText).toContain('# Stand Up For Democracy');
    expect(bodyText).toContain('Join fellow activists');
    expect(bodyText).toContain(
      '![Rally banner photo](https://images.unsplash.com/photo-1540910419892-4a36d2c3266c)'
    );
    expect(bodyText).toContain('> "Grassroots democracy is our strongest defense."');
    expect(bodyText).toContain('— Elena Rostova, Carmichael Organizer');
    expect(bodyText).toContain('📊 STAT: 1,450 | Voters Mobilized | Across CA-06 in 2026');
    expect(bodyText).toContain('• Arrive at 10 AM');
    expect(bodyText).toContain('> [!ALERT] Bring Signs');
    expect(bodyText).toContain('👉 [Action: RSVP Now] - https://indivisiblefairoaks.org/actions');
    expect(bodyText).toContain('📅 EVENT: Emergency Demonstration');
    expect(bodyText).toContain('🌐 CONNECT: Connect & Mobilize');
    expect(bodyText).toContain('---');
    expect(bodyText).toContain('In solidarity,\nIndivisible Fair Oaks');

    // Round-trip parse
    const parsed = parseBodyToBlocks(bodyText);
    expect(parsed.length).toBeGreaterThanOrEqual(10);
    expect(parsed.some((b) => b.type === 'header')).toBe(true);
    expect(parsed.some((b) => b.type === 'button')).toBe(true);
    expect(parsed.some((b) => b.type === 'callout')).toBe(true);
    expect(parsed.some((b) => b.type === 'image')).toBe(true);
    expect(parsed.some((b) => b.type === 'quote')).toBe(true);
    expect(parsed.some((b) => b.type === 'stat')).toBe(true);
    expect(parsed.some((b) => b.type === 'list')).toBe(true);
    expect(parsed.some((b) => b.type === 'social')).toBe(true);
    expect(parsed.some((b) => b.type === 'event')).toBe(true);
  });

  it('provides 5 rich activist templates with populated blocks', () => {
    expect(CAMPAIGN_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    for (const tmpl of CAMPAIGN_TEMPLATES) {
      expect(tmpl.name).toBeDefined();
      expect(tmpl.subject).toBeDefined();
      expect(tmpl.blocks.length).toBeGreaterThan(3);
      const text = serializeBlocksToBody(tmpl.blocks);
      expect(text.length).toBeGreaterThan(50);
    }
  });

  it('round-trips an image block with no chosen image yet', () => {
    // New image blocks start empty (chosen later from Supabase storage).
    // Serializing one must produce text that parses back into an image block —
    // not a text block — or toggling to text mode silently converts it.
    const blocks: ComposerBlock[] = [{ id: 'b_empty', type: 'image', url: '', alt: '' }];
    const body = serializeBlocksToBody(blocks);
    expect(body).toContain('![Image]()');
    const parsed = parseBodyToBlocks(body);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].type).toBe('image');
    if (parsed[0].type === 'image') expect(parsed[0].url).toBe('');
  });

  it('parses an empty-url image with link and caption', () => {
    const parsed = parseBodyToBlocks(
      '[![rally]()](https://indivisiblefairoaks.org/actions)\n*caption here*'
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0].type).toBe('image');
    if (parsed[0].type === 'image') {
      expect(parsed[0].url).toBe('');
      expect(parsed[0].linkUrl).toBe('https://indivisiblefairoaks.org/actions');
      expect(parsed[0].caption).toBe('caption here');
    }
  });

  it('renders reading stats and allows switching email viewport framing in VisualComposerCanvas', async () => {
    const blocks: ComposerBlock[] = [
      { id: 'b1', type: 'header', heading: 'Important Civic Gathering', level: 1 },
      { id: 'b2', type: 'text', content: 'We need all hands on deck for Saturday morning.' },
    ];
    const onChange = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<VisualComposerCanvas blocks={blocks} onChange={onChange} />);
    });

    // Renders reading stats
    expect(container.textContent).toMatch(/\d+w · ~\d+m read/);

    // Renders canvas viewport switcher
    const standardBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Standard email canvas"]'
    );
    const mobileBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Mobile phone canvas"]'
    );
    const fullBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Full width canvas"]'
    );

    expect(standardBtn).not.toBeNull();
    expect(mobileBtn).not.toBeNull();
    expect(fullBtn).not.toBeNull();

    // Click standard email (600px)
    await act(async () => {
      standardBtn?.click();
    });
    expect(container.querySelector('.max-w-\\[600px\\]')).not.toBeNull();

    // Click mobile phone (375px)
    await act(async () => {
      mobileBtn?.click();
    });
    expect(container.querySelector('.max-w-\\[375px\\]')).not.toBeNull();

    // Click full width (100%)
    await act(async () => {
      fullBtn?.click();
    });
    expect(container.querySelector('.w-full')).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
