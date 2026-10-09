import type { ComposerBlock, SocialLinkItem, SocialPlatform } from './types';

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
      case 'image': {
        const lines: string[] = [];
        const alt = block.alt?.trim() || 'Image';
        const url = block.url?.trim() || '';
        if (block.linkUrl?.trim()) {
          lines.push(`[![${alt}](${url})](${block.linkUrl.trim()})`);
        } else {
          lines.push(`![${alt}](${url})`);
        }
        if (block.caption?.trim()) {
          lines.push(`*${block.caption.trim()}*`);
        }
        chunks.push(lines.join('\n'));
        break;
      }
      case 'quote': {
        const lines: string[] = [];
        lines.push(`> "${block.quote.trim()}"`);
        const attribution = [block.author.trim(), block.role?.trim()].filter(Boolean).join(', ');
        if (attribution) {
          lines.push(`> — ${attribution}`);
        }
        chunks.push(lines.join('\n'));
        break;
      }
      case 'stat': {
        const desc = block.description?.trim() ? ` | ${block.description.trim()}` : '';
        chunks.push(`📊 STAT: ${block.value.trim()} | ${block.label.trim()}${desc}`);
        break;
      }
      case 'list': {
        const items = block.items.filter((i) => i.trim().length > 0);
        if (items.length > 0) {
          const formatted = items.map((item, idx) =>
            block.style === 'numbered' ? `${idx + 1}. ${item.trim()}` : `• ${item.trim()}`
          );
          chunks.push(formatted.join('\n'));
        }
        break;
      }
      case 'social': {
        const links = (block.channels || [])
          .filter((c) => c.url.trim().length > 0)
          .map((c) => `[${c.label || c.platform}](${c.url.trim()})`);
        if (links.length > 0) {
          const heading = block.heading?.trim() ? `${block.heading.trim()}\n` : '';
          chunks.push(`🌐 CONNECT: ${heading}${links.join(' · ')}`);
        }
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

    // Image with optional link: [![alt](url)](link) or ![alt](url).
    // The image url admits the empty string (or a bare scheme-less value is
    // still prose): a new image block starts without one (chosen later from
    // Supabase storage), serializes as `![alt]()`, and must parse back into
    // an image block — not a text block — or toggling to text mode silently
    // converts the block out from under the author. A non-empty value that is
    // not a URL still falls through to text: empty means "not chosen yet",
    // anything else unparseable is just prose. The link target keeps `+`: a
    // click-through to nowhere is never a block the editor produced.
    const linkedImgMatch = s.match(
      /^\[!\[([^\]]*)\]\(((?:https?:\/\/)?[^\s)]*)\)\]\((https?:\/\/[^\s)]+)\)(?:\n\*(.*?)\*)?$/s
    );
    if (linkedImgMatch) {
      blocks.push({
        id: genId(),
        type: 'image',
        alt: linkedImgMatch[1]?.trim() || '',
        url: linkedImgMatch[2]?.trim() || '',
        linkUrl: linkedImgMatch[3]?.trim() || '',
        caption: linkedImgMatch[4]?.trim() || undefined,
        alignment: 'center',
      });
      continue;
    }

    const plainImgMatch = s.match(/^!\[([^\]]*)\]\(((?:https?:\/\/)?[^\s)]*)\)(?:\n\*(.*?)\*)?$/s);
    if (plainImgMatch) {
      blocks.push({
        id: genId(),
        type: 'image',
        alt: plainImgMatch[1]?.trim() || '',
        url: plainImgMatch[2]?.trim() || '',
        caption: plainImgMatch[3]?.trim() || undefined,
        alignment: 'center',
      });
      continue;
    }

    // Stat metric: 📊 STAT: value | label [| description]
    const statMatch = s.match(/^📊\s*(?:STAT:\s*)?([^|\n]+)\s*\|\s*([^|\n]+)(?:\s*\|\s*(.+))?$/);
    if (statMatch) {
      blocks.push({
        id: genId(),
        type: 'stat',
        value: statMatch[1]?.trim() || '',
        label: statMatch[2]?.trim() || '',
        description: statMatch[3]?.trim() || undefined,
        variant: 'primary',
      });
      continue;
    }

    // Social bar: 🌐 CONNECT: [label](url) · [label](url)
    if (s.startsWith('🌐 CONNECT:') || s.startsWith('🌐')) {
      const linksText = s.replace(/^🌐\s*(?:CONNECT:\s*)?/, '');
      const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
      const channels: SocialLinkItem[] = [];
      let match = linkRegex.exec(linksText);
      while (match) {
        const label = match[1]?.trim() || 'Link';
        const url = match[2]?.trim() || '';
        const lowerLabel = label.toLowerCase();
        let platform: SocialPlatform = 'website';
        if (lowerLabel.includes('actblue') || lowerLabel.includes('donate')) platform = 'actblue';
        else if (lowerLabel.includes('facebook')) platform = 'facebook';
        else if (lowerLabel.includes('instagram')) platform = 'instagram';
        else if (lowerLabel.includes('twitter') || lowerLabel.includes('x')) platform = 'twitter';
        else if (lowerLabel.includes('substack')) platform = 'substack';

        channels.push({ platform, url, label });
        match = linkRegex.exec(linksText);
      }
      if (channels.length > 0) {
        blocks.push({
          id: genId(),
          type: 'social',
          heading: 'Connect & Mobilize',
          channels,
        });
        continue;
      }
    }

    // Header: [EYEBROW] followed by # Heading
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

    // Quote or Callout: lines starting with '>'
    if (s.startsWith('>')) {
      const lines = s.split('\n').map((l) => l.replace(/^>\s?/, ''));
      const firstLine = lines[0] || '';

      // Check if it's a Callout: [!ALERT|INFO|SUCCESS]
      const calloutMatch = firstLine.match(/^\[!(ALERT|INFO|SUCCESS)\](?:\s+(.*))?$/i);
      if (calloutMatch) {
        const v = (calloutMatch[1] || 'INFO').toLowerCase();
        const variant = v === 'alert' ? 'alert' : v === 'success' ? 'success' : 'info';
        const title = calloutMatch[2]?.trim() || undefined;
        const contentLines = lines.slice(1);
        blocks.push({
          id: genId(),
          type: 'callout',
          variant,
          title,
          text: contentLines.join('\n').trim(),
        });
        continue;
      }

      // Check if it's a Quote: > "..." \n > — Author, Role
      const quoteMatch = firstLine.match(/^["“](.*?)["”]?$/);
      if (quoteMatch || lines.some((l) => l.startsWith('—') || l.startsWith('- '))) {
        let quoteText = '';
        let author = 'Community Organizer';
        let role = '';

        for (const line of lines) {
          if (line.startsWith('—') || line.startsWith('--')) {
            const parts = line
              .replace(/^[—-]+/, '')
              .split(',')
              .map((p) => p.trim());
            author = parts[0] || 'Community Member';
            role = parts[1] || '';
          } else {
            quoteText += (quoteText ? ' ' : '') + line.replace(/^["“]|["”]$/g, '').trim();
          }
        }

        blocks.push({
          id: genId(),
          type: 'quote',
          quote: quoteText.trim(),
          author,
          role: role || undefined,
        });
        continue;
      }

      // Fallback callout
      blocks.push({
        id: genId(),
        type: 'callout',
        variant: 'info',
        text: lines.join('\n').trim(),
      });
      continue;
    }

    // Button: 👉 [Action: Label] - url
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

    // List: all lines begin with bullet (- or * or •) or numbered (1. 2.)
    const listLines = s
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const isBulletList = listLines.every((l) => /^[-*•]\s+/.test(l));
    const isNumberedList = listLines.every((l) => /^\d+\.\s+/.test(l));

    if (listLines.length > 1 && (isBulletList || isNumberedList)) {
      const items = listLines.map((l) => l.replace(/^[-*•\d.]+\s+/, '').trim());
      blocks.push({
        id: genId(),
        type: 'list',
        style: isNumberedList ? 'numbered' : 'bullet',
        items,
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
