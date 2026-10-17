// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatWallEMessage, renderInlineMarkdown } from '@/lib/walle-format';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('walle-format', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  describe('renderInlineMarkdown', () => {
    it('returns plain text when no markdown is present', async () => {
      await act(async () => {
        root.render(<div>{renderInlineMarkdown('Hello world')}</div>);
      });
      expect(container.textContent).toBe('Hello world');
    });

    it('renders bold text with strong tag', async () => {
      await act(async () => {
        root.render(<div>{renderInlineMarkdown('This is **bold** text')}</div>);
      });
      const strong = container.querySelector('strong');
      expect(strong).not.toBeNull();
      expect(strong?.textContent).toBe('bold');
    });

    it('renders inline code with code tag', async () => {
      await act(async () => {
        root.render(<div>{renderInlineMarkdown('Run `npm test` here')}</div>);
      });
      const code = container.querySelector('code');
      expect(code).not.toBeNull();
      expect(code?.textContent).toBe('npm test');
    });

    it('renders links with proper href and external target', async () => {
      await act(async () => {
        root.render(
          <div>
            {renderInlineMarkdown('Visit [our site](https://example.com) or [events](/events)')}
          </div>
        );
      });
      const links = container.querySelectorAll('a');
      expect(links).toHaveLength(2);
      expect(links[0].getAttribute('href')).toBe('https://example.com');
      expect(links[0].getAttribute('target')).toBe('_blank');
      expect(links[1].getAttribute('href')).toBe('/events');
      expect(links[1].getAttribute('target')).toBeNull();
    });
  });

  describe('formatWallEMessage', () => {
    it('renders unordered list for lines starting with - or *', async () => {
      const content = 'Here are the items:\n\n- First event\n- Second event';
      await act(async () => {
        root.render(<div>{formatWallEMessage(content)}</div>);
      });
      const list = container.querySelector('ul');
      expect(list).not.toBeNull();
      const items = container.querySelectorAll('li');
      expect(items).toHaveLength(2);
      expect(items[0].textContent).toBe('First event');
      expect(items[1].textContent).toBe('Second event');
    });

    it('renders ordered list for lines starting with numbers', async () => {
      const content = 'Follow these steps:\n\n1. Register to vote\n2. Cast your ballot';
      await act(async () => {
        root.render(<div>{formatWallEMessage(content)}</div>);
      });
      const list = container.querySelector('ol');
      expect(list).not.toBeNull();
      const items = container.querySelectorAll('li');
      expect(items).toHaveLength(2);
      expect(items[0].textContent).toBe('Register to vote');
      expect(items[1].textContent).toBe('Cast your ballot');
    });

    it('renders multiple paragraphs and preserves single line breaks', async () => {
      const content = 'First paragraph.\nSecond line of first.\n\nSecond paragraph.';
      await act(async () => {
        root.render(<div>{formatWallEMessage(content)}</div>);
      });
      const paragraphs = container.querySelectorAll('p');
      expect(paragraphs).toHaveLength(2);
      expect(paragraphs[0].querySelector('br')).not.toBeNull();
    });
  });
});
