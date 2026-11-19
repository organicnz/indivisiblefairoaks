// @vitest-environment jsdom-same-realm
import { describe, expect, it } from 'vitest';
import { resolveBlockContentRoot } from '../visual-edit-overlay-helpers';

describe('resolveBlockContentRoot', () => {
  const section = document.createElement('section');
  const paragraph = document.createElement('p');
  const link = document.createElement('a');
  paragraph.append('Read the ', link);
  section.append(paragraph);

  it('climbs from an inline element to the paragraph inside the section', () => {
    expect(resolveBlockContentRoot(link, section)).toBe(paragraph);
  });

  it('refuses the layout wrapper as a block content root', () => {
    // The <section> is a block's DOM address, not its content: reading it
    // would capture every sibling block too.
    expect(resolveBlockContentRoot(section, section)).toBeNull();
  });

  it('accepts a textual block root', () => {
    expect(resolveBlockContentRoot(paragraph, paragraph)).toBe(paragraph);
  });

  it('accepts the cw- div roots the serializer writes for callouts and buttons', () => {
    const callout = document.createElement('div');
    callout.className = 'cw cw-callout cw-callout--info';
    const inner = document.createElement('p');
    callout.append(inner);
    expect(resolveBlockContentRoot(inner, callout)).toBe(inner);
    expect(resolveBlockContentRoot(callout, callout)).toBe(callout);
  });
});
