import type { ComposerBlock } from './types';

function genId(): string {
  return `b_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Serializes visual composer blocks into plain-text/markdown body
 * suitable for Resend delivery, brand shell escaping, and email client linkification.
 */
export function serializeBlocksToBody(blocks: ComposerBlock[]): string {
  const chunks: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'header': {
        const parts: string[] = [];
        if (block.eyebrow?.trim()) {
          parts.push(`[${block.eyebrow.trim().toUpperCase()}]`);
        }
        const prefix = block.level === 2 ? '##' : '#';
        parts.push(`${prefix} ${block.heading.trim()}`);
        chunks.push(parts.join('\n'));
        break;
      }
      case 'text': {
        if (block.content.trim()) {
          chunks.push(block.content.trim());
        }
        break;
      }
      case 'callout': {
        const lines: string[] = [];
        const variant = (block.variant || 'info').toUpperCase();
        if (block.title?.trim()) {
          lines.push(`> [!${variant}] ${block.title.trim()}`);
        } else {
          lines.push(`> [!${variant}]`);
        }
        for (const line of block.text.trim().split('\n')) {
          lines.push(`> ${line}`);
        }
        chunks.push(lines.join('\n'));
        break;
      }
      case 'button': {
        const label = block.label.trim() || 'Click here';
        const url = block.url.trim();
        if (url) {
          chunks.push(`👉 [Action: ${label}] - ${url}`);
        } else {
          chunks.push(`👉 [Action: ${label}]`);
        }
        break;
      }
      case 'event': {
        const lines: string[] = [];
        lines.push(`📅 EVENT: ${block.title.trim()}`);
        if (block.date || block.time) {
          const dt = [block.date, block.time].filter(Boolean).join(' · ');
          lines.push(`When: ${dt}`);
        }
        if (block.location?.trim()) {
          lines.push(`Where: ${block.location.trim()}`);
        }
        if (block.rsvpUrl?.trim()) {
          lines.push(`RSVP: ${block.rsvpUrl.trim()}`);
        }
        chunks.push(lines.join('\n'));
        break;
      }
      case 'divider': {
        chunks.push('---');
        break;
      }
      case 'signoff': {
        const parts: string[] = [];
        if (block.closing?.trim()) parts.push(block.closing.trim());
        if (block.sender?.trim()) parts.push(block.sender.trim());
        chunks.push(parts.join('\n'));
        break;
      }
    }
  }

  return chunks.join('\n\n').trim();
}

/**
 * Parses raw text or markdown back into visual ComposerBlock array
 * to provide two-way editing synchronization.
 */
export function parseBodyToBlocks(body: string): ComposerBlock[] {
  const trimmed = body.trim();
  if (!trimmed) {
    return [
      {
        id: genId(),
        type: 'text',
        content: '',
      },
    ];
  }

  const rawSections = trimmed.split(/\n{2,}/);
  const blocks: ComposerBlock[] = [];

  for (const section of rawSections) {
    const s = section.trim();
    if (!s) continue;

    // Divider
    if (s === '---' || s === '***' || s === '___') {
      blocks.push({ id: genId(), type: 'divider' });
      continue;
    }

    // Header
    const headerMatch = s.match(/^(?:\[([A-Z0-9_\-\s]+)\]\n)?(#+)\s+(.+)$/m);
    if (headerMatch) {
      const eyebrow = headerMatch[1];
      const hashes = headerMatch[2];
      const heading = headerMatch[3];
      blocks.push({
        id: genId(),
        type: 'header',
        eyebrow: eyebrow || undefined,
        heading: heading.trim(),
        level: hashes.length >= 2 ? 2 : 1,
      });
      continue;
    }

    // Callout
    if (s.startsWith('>')) {
      const lines = s.split('\n').map((l) => l.replace(/^>\s?/, ''));
      let variant: 'info' | 'alert' | 'success' = 'info';
      let title: string | undefined;

      const firstLine = lines[0] || '';
      const calloutMatch = firstLine.match(/^\[!(ALERT|INFO|SUCCESS)\](?:\s+(.*))?$/i);
      let contentLines = lines;

      if (calloutMatch) {
        const v = (calloutMatch[1] || 'INFO').toLowerCase();
        variant = v === 'alert' ? 'alert' : v === 'success' ? 'success' : 'info';
        title = calloutMatch[2]?.trim() || undefined;
        contentLines = lines.slice(1);
      }

      blocks.push({
        id: genId(),
        type: 'callout',
        variant,
        title,
        text: contentLines.join('\n').trim(),
      });
      continue;
    }

    // Button
    const btnMatch = s.match(/^👉\s*\[(?:Action:\s*)?([^\]]+)\](?:\s*-\s*(\S+))?/);
    if (btnMatch) {
      blocks.push({
        id: genId(),
        type: 'button',
        label: btnMatch[1]?.trim() || 'Action',
        url: btnMatch[2]?.trim() || '',
        variant: 'primary',
      });
      continue;
    }

    // Markdown button: [Label](url) alone in paragraph
    const mdBtnMatch = s.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (mdBtnMatch) {
      blocks.push({
        id: genId(),
        type: 'button',
        label: mdBtnMatch[1]?.trim() || 'Action',
        url: mdBtnMatch[2]?.trim() || '',
        variant: 'primary',
      });
      continue;
    }

    // Event
    if (s.startsWith('📅 EVENT:') || s.startsWith('EVENT:')) {
      const lines = s.split('\n');
      const title = lines[0].replace(/^(?:📅\s*)?EVENT:\s*/, '').trim();
      let date = '';
      let time = '';
      let location = '';
      let rsvpUrl = '';

      for (const line of lines.slice(1)) {
        if (/^When:/i.test(line)) {
          const val = line.replace(/^When:\s*/i, '').trim();
          const parts = val.split('·').map((p) => p.trim());
          date = parts[0] || '';
          time = parts[1] || '';
        } else if (/^Where:/i.test(line)) {
          location = line.replace(/^Where:\s*/i, '').trim();
        } else if (/^RSVP:/i.test(line)) {
          rsvpUrl = line.replace(/^RSVP:\s*/i, '').trim();
        }
      }

      blocks.push({
        id: genId(),
        type: 'event',
        title,
        date,
        time,
        location,
        rsvpUrl,
      });
      continue;
    }

    // Default: text block
    blocks.push({
      id: genId(),
      type: 'text',
      content: s,
    });
  }

  return blocks.length > 0 ? blocks : [{ id: genId(), type: 'text', content: '' }];
}
