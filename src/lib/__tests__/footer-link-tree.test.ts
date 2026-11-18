// @vitest-environment node
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/queries/civic', () => ({
  getDataPoints: vi.fn(async () => ({})),
}));

vi.mock('@/components/layout/ThemeToggle', () => ({
  ThemeToggle: () => null,
}));

vi.mock('@/components/ui/DataPoint', () => ({
  DataPoint: ({ children }: { children?: ReactNode }) => children,
}));

import { Footer } from '@/components/layout/Footer';

function findDataPoint(
  node: ReactNode,
  name: string
): ReactElement<{ children?: ReactNode }> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findDataPoint(child, name);
      if (match) return match;
    }
    return null;
  }

  if (!isValidElement(node)) return null;

  const props = node.props as { name?: string; children?: ReactNode };
  if (props.name === name) {
    return node as ReactElement<{ children?: ReactNode }>;
  }

  return findDataPoint(props.children, name);
}

describe('Footer Link Tree naming', () => {
  it('uses Link Tree & Action Links for the links navigation label', async () => {
    const tree = await Footer();
    const linksLabel = findDataPoint(tree, 'footer.nav.links');

    expect(linksLabel).not.toBeNull();
    expect(linksLabel?.props.children).toBe('Link Tree & Action Links');
  });
});
