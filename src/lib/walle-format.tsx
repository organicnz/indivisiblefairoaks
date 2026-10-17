import type { ReactNode } from 'react';

/**
 * Tokenize and render inline markdown: **bold**, `code`, [label](url).
 * Pure React elements without raw HTML injection.
 */
export function renderInlineMarkdown(text: string): ReactNode {
  if (!text) return null;

  // Regex matches:
  // 1. [label](url)
  // 2. **bold**
  // 3. `code`
  const regex = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g;
  const parts = text.split(regex);

  if (parts.length === 1) {
    return text;
  }

  const elements: ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    // Markdown link: [label](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, url] = linkMatch;
      const isInternal = url.startsWith('/') || url.startsWith('#');
      elements.push(
        <a
          key={`link-${i}-${url}`}
          href={url}
          target={isInternal ? undefined : '_blank'}
          rel={isInternal ? undefined : 'noopener noreferrer'}
          className="font-semibold text-primary dark:text-primary-on-dark underline underline-offset-2 hover:text-primary-light transition-colors"
        >
          {label}
        </a>
      );
      continue;
    }

    // Bold text: **text**
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      elements.push(
        <strong
          key={`bold-${i}-${part.slice(2, 8)}`}
          className="font-bold text-slate-900 dark:text-white"
        >
          {part.slice(2, -2)}
        </strong>
      );
      continue;
    }

    // Inline code: `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      elements.push(
        <code
          key={`code-${i}-${part.slice(1, 8)}`}
          className="rounded bg-slate-100 dark:bg-slate-700/80 px-1 py-0.5 font-mono text-xs text-slate-800 dark:text-slate-200"
        >
          {part.slice(1, -1)}
        </code>
      );
      continue;
    }

    elements.push(part);
  }

  return elements;
}

/**
 * Formats multi-paragraph assistant messages into structured React elements.
 * Handles paragraphs, unordered lists, numbered lists, and inline formatting.
 */
export function formatWallEMessage(content: string): ReactNode {
  if (!content) return null;

  // Split by double newlines into blocks
  const blocks = content.trim().split(/\n{2,}/);
  const renderedBlocks: ReactNode[] = [];

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const block = blocks[blockIndex];
    const lines = block.split('\n').map((line) => line.trim());

    // Check if block is a bullet list (lines starting with - or *)
    const isBulletList = lines.every((line) => line.startsWith('- ') || line.startsWith('* '));
    if (isBulletList && lines.length > 0) {
      const listItems: ReactNode[] = [];
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        listItems.push(
          <li key={`bullet-${blockIndex}-${lineIndex}`}>
            {renderInlineMarkdown(lines[lineIndex].slice(2))}
          </li>
        );
      }
      renderedBlocks.push(
        <ul
          key={`ul-${blockIndex}`}
          className="my-1.5 space-y-1 pl-4 list-disc marker:text-primary dark:marker:text-primary-bright"
        >
          {listItems}
        </ul>
      );
      continue;
    }

    // Check if block is a numbered list (lines starting with \d+\.)
    const isNumberedList = lines.every((line) => /^\d+\.\s+/.test(line));
    if (isNumberedList && lines.length > 0) {
      const listItems: ReactNode[] = [];
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        listItems.push(
          <li key={`num-${blockIndex}-${lineIndex}`}>
            {renderInlineMarkdown(lines[lineIndex].replace(/^\d+\.\s+/, ''))}
          </li>
        );
      }
      renderedBlocks.push(
        <ol
          key={`ol-${blockIndex}`}
          className="my-1.5 space-y-1 pl-4 list-decimal marker:text-primary dark:marker:text-primary-bright"
        >
          {listItems}
        </ol>
      );
      continue;
    }

    // Standard paragraph: preserve single line breaks
    const paragraphSpans: ReactNode[] = [];
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      paragraphSpans.push(
        <span key={`span-${blockIndex}-${lineIndex}`}>
          {lineIndex > 0 ? <br /> : null}
          {renderInlineMarkdown(lines[lineIndex])}
        </span>
      );
    }
    renderedBlocks.push(
      <p key={`p-${blockIndex}`} className="whitespace-pre-wrap">
        {paragraphSpans}
      </p>
    );
  }

  return <div className="space-y-2 text-sm leading-relaxed">{renderedBlocks}</div>;
}
