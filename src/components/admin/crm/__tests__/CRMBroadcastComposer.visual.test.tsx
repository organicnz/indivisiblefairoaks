import { describe, expect, it } from 'vitest';
import { parseBodyToBlocks, serializeBlocksToBody } from '@/components/admin/crm/composer/parser';
import { CAMPAIGN_TEMPLATES } from '@/components/admin/crm/composer/templates';
import type { ComposerBlock } from '@/components/admin/crm/composer/types';

describe('Visual Composer parser & templates', () => {
  it('serializes and parses blocks with high fidelity', () => {
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
    expect(bodyText).toContain('> [!ALERT] Bring Signs');
    expect(bodyText).toContain('👉 [Action: RSVP Now] - https://indivisiblefairoaks.org/actions');
    expect(bodyText).toContain('📅 EVENT: Emergency Demonstration');
    expect(bodyText).toContain('---');
    expect(bodyText).toContain('In solidarity,\nIndivisible Fair Oaks');

    // Round-trip parse
    const parsed = parseBodyToBlocks(bodyText);
    expect(parsed.length).toBeGreaterThanOrEqual(6);
    expect(parsed.some((b) => b.type === 'header')).toBe(true);
    expect(parsed.some((b) => b.type === 'button')).toBe(true);
    expect(parsed.some((b) => b.type === 'callout')).toBe(true);
  });

  it('provides 4 rich activist templates with populated blocks', () => {
    expect(CAMPAIGN_TEMPLATES).toHaveLength(4);
    for (const tmpl of CAMPAIGN_TEMPLATES) {
      expect(tmpl.name).toBeDefined();
      expect(tmpl.subject).toBeDefined();
      expect(tmpl.blocks.length).toBeGreaterThan(3);
      const text = serializeBlocksToBody(tmpl.blocks);
      expect(text.length).toBeGreaterThan(50);
    }
  });
});
