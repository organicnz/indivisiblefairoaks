// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseHtml } from '@/lib/blocks';
import { sanitizeWPContent } from '@/lib/sanitize';
import { VISUAL_EDIT_PARAM } from '@/lib/visual-edit-mode';
import {
  blockIndexForDomIndex,
  buildVisualSections,
  canMoveSection,
  discoverPageSections,
  isPublishedSectionListCurrent,
  moveTargetForSection,
  publishSections,
  sectionForDomIndex,
  sectionLabelForBlock,
} from '@/lib/visual-sections';

/**
 * The reconciliation between the block model and the rendered DOM.
 *
 * Every test here is a case the previous positional mapping got wrong. The
 * bodies are real ones: a sanitizer that removes an element between two blocks
 * is not an exotic input, it is what `MIGRATED_PAGE_FURNITURE` does to a
 * migrated page on every render.
 *
 * So the fixtures go through the same two steps the page does — `parseHtml` for
 * the model, `sanitizeWPContent` for the DOM. A test that built the DOM by
 * hand would keep the markup the sanitizer deletes and pass either way.
 */

function render(body: string): { blocks: ReturnType<typeof parseHtml>; elements: Element[] } {
  const container = document.createElement('div');
  container.innerHTML = sanitizeWPContent(body);
  return { blocks: parseHtml(body), elements: Array.from(container.children) };
}

describe('buildVisualSections', () => {
  it('pairs each block with the element that renders it', () => {
    const { blocks, elements } = render('<h2>Mission</h2><p>We organise.</p>');
    const sections = buildVisualSections(blocks, elements);

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({ blockIndex: 0, domIndex: 0, label: 'Mission' });
    expect(sections[1]).toMatchObject({ blockIndex: 1, domIndex: 1, label: 'We organise.' });
  });

  it('keeps addressing correct when the sanitizer removed a middle element', () => {
    // The <form> parses to a block but never reaches the DOM, so the heading is
    // the second *rendered* child while being the third block. Positional
    // correlation reported block 1 for it — the form.
    const { blocks, elements } = render('<p>Intro copy.</p><form><input></form><h2>Mission</h2>');
    expect(blocks).toHaveLength(3);
    expect(elements).toHaveLength(2);

    const sections = buildVisualSections(blocks, elements);
    const heading = sectionForDomIndex(sections, 1);

    expect(heading).not.toBeNull();
    expect(heading?.blockIndex).toBe(2);
    expect(heading?.label).toBe('Mission');
    expect(heading?.blockType).toBe('heading');
  });

  it('leaves a block with no element addressable but still listed', () => {
    const { blocks, elements } = render('<p>Intro.</p><form><input></form>');
    const sections = buildVisualSections(blocks, elements);

    expect(sections).toHaveLength(2);
    expect(sections[1].blockIndex).toBe(1);
    expect(sections[1].domIndex).toBeNull();
  });

  it('falls back to document order for elements with no distinguishing text', () => {
    const { blocks, elements } = render('<hr><hr>');
    const sections = buildVisualSections(blocks, elements);

    expect(sections).toHaveLength(2);
    expect(sections.map((section) => section.domIndex)).toEqual([0, 1]);
    expect(sections.map((section) => section.label)).toEqual(['Divider', 'Divider']);
  });

  it('survives duplicate labels, which is where content matching alone fails', () => {
    const { blocks, elements } = render('<h2>Act</h2><h2>Act</h2><h2>Act</h2>');
    const sections = buildVisualSections(blocks, elements);

    expect(sections.map((section) => section.domIndex)).toEqual([0, 1, 2]);
    expect(sections.every((section) => section.label === 'Act')).toBe(true);
  });

  it('numbers sections from one for the readout', () => {
    const { blocks, elements } = render('<h2>One</h2><h2>Two</h2>');
    expect(buildVisualSections(blocks, elements).map((s) => s.ordinal)).toEqual([1, 2]);
  });
});

describe('blockIndexForDomIndex', () => {
  it('resolves the block the navbar addressed', () => {
    const { blocks, elements } = render('<p>Intro.</p><form><input></form><h2>Mission</h2>');
    const sections = buildVisualSections(blocks, elements);

    expect(blockIndexForDomIndex(sections, 0)).toBe(0);
    expect(blockIndexForDomIndex(sections, 1)).toBe(2);
  });

  it('returns null rather than guessing when the ordinal addresses nothing', () => {
    const { blocks, elements } = render('<h2>Only</h2>');
    expect(blockIndexForDomIndex(buildVisualSections(blocks, elements), 7)).toBeNull();
  });
});

describe('moveTargetForSection', () => {
  it('moves within the document, so a sanitizer-removed block still counts', () => {
    const { blocks, elements } = render('<p>Intro.</p><form><input></form><h2>Mission</h2>');
    const sections = buildVisualSections(blocks, elements);

    // The heading's neighbour in the *document* is the form block, not the
    // paragraph. Swapping with the paragraph would silently delete the form
    // from the page, which is a migration the operator never asked for.
    expect(moveTargetForSection(sections, 2, 'up')).toBe(1);
    expect(moveTargetForSection(sections, 0, 'down')).toBe(1);
  });

  it('moves a rendered section to the adjacent rendered block', () => {
    const { blocks, elements } = render('<h2>Top</h2><h2>Bottom</h2>');
    const sections = buildVisualSections(blocks, elements);

    expect(moveTargetForSection(sections, 1, 'up')).toBe(0);
    expect(moveTargetForSection(sections, 0, 'down')).toBe(1);
  });

  it('has nowhere to go at either end', () => {
    const { blocks, elements } = render('<h2>Top</h2><h2>Bottom</h2>');
    const sections = buildVisualSections(blocks, elements);

    expect(canMoveSection(sections, 0, 'up')).toBe(false);
    expect(canMoveSection(sections, 1, 'down')).toBe(false);
    expect(canMoveSection(sections, 0, 'down')).toBe(true);
  });

  it('reports no target for a block that is not a section', () => {
    const { blocks, elements } = render('<h2>Only</h2>');
    expect(moveTargetForSection(buildVisualSections(blocks, elements), 99, 'up')).toBeNull();
  });
});

describe('publishSections', () => {
  it('carries the block index across the event boundary', () => {
    const { blocks, elements } = render('<p>Intro.</p><form><input></form><h2>Mission</h2>');
    const published = publishSections(buildVisualSections(blocks, elements));

    // Three sections, because the form block is part of the document even
    // though no element renders it — and it is the only way an operator can
    // reach it to delete it.
    expect(published).toEqual([
      { index: 0, label: 'Intro.', blockIndex: 0, blockType: 'paragraph', enabled: false },
      {
        index: null,
        label: 'Preserved markup',
        blockIndex: 1,
        blockType: 'unsupported',
        enabled: false,
      },
      { index: 1, label: 'Mission', blockIndex: 2, blockType: 'heading', enabled: false },
    ]);
  });

  it('never gives two sections the same address', () => {
    const { blocks, elements } = render('<p>a</p><form><input></form><p>b</p>');
    const published = publishSections(buildVisualSections(blocks, elements));
    const addresses = published.map((section) => section.index).filter((i) => i !== null);

    expect(new Set(addresses).size).toBe(addresses.length);
  });
});

describe('discoverPageSections', () => {
  it('reads the DOM when the overlay has published nothing', () => {
    const main = document.createElement('main');
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = 'Community Voices';
    section.appendChild(heading);
    main.appendChild(section);

    const discovered = discoverPageSections(main);

    expect(discovered).toEqual([
      { index: 0, label: 'Community Voices', blockIndex: null, blockType: null, enabled: false },
    ]);
  });

  it('returns nothing for a container that is not a living DOM', () => {
    expect(discoverPageSections(null)).toEqual([]);
  });
});
describe('sectionLabelForBlock', () => {
  it('names a block whose text is empty rather than showing a blank row', () => {
    const [divider] = parseHtml('<hr>');
    expect(sectionLabelForBlock(divider)).toBe('Divider');
  });

  it('prefers the block text over the type name', () => {
    const [image] = parseHtml(
      '<figure class="cw-figure"><img src="/a.png" alt="Volunteers at the phone bank"></figure>'
    );
    expect(sectionLabelForBlock(image)).toBe('Volunteers at the phone bank');
  });

  it('falls back to the type name for an image with no alt', () => {
    const [image] = parseHtml('<figure class="cw-figure"><img src="/a.png"></figure>');
    expect(sectionLabelForBlock(image)).toBe('Image');
  });
});

describe('VISUAL_EDIT_PARAM', () => {
  it('is the additive query parameter the header links carry', () => {
    // Re-exported here so a rename that breaks the shared surface fails next to
    // the code that depends on it rather than in the browser.
    expect(VISUAL_EDIT_PARAM).toBe('visual-edit');
  });
});

describe('isPublishedSectionListCurrent', () => {
  /**
   * One page can hold several documents now — one per copy region — so a
   * publication is only "about this page" when its region matches too.
   */
  it('accepts a publication for the page and region on screen', () => {
    expect(
      isPublishedSectionListCurrent(
        { pathname: '/about', regionId: 'about-mission' },
        '/about',
        'about-mission'
      )
    ).toBe(true);
    // The whole page is region null.
    expect(
      isPublishedSectionListCurrent({ pathname: '/about', regionId: null }, '/about', null)
    ).toBe(true);
  });

  it('rejects a publication from another page', () => {
    expect(
      isPublishedSectionListCurrent({ pathname: '/choir', regionId: null }, '/about', null)
    ).toBe(false);
  });

  it('rejects a publication from another region on the same page', () => {
    // The exact bug: switching regions in the header menu used to leave the
    // previous region's section list on screen, offering controls that addressed
    // blocks in a document the operator had left.
    expect(
      isPublishedSectionListCurrent(
        { pathname: '/about', regionId: 'about-who' },
        '/about',
        'about-mission'
      )
    ).toBe(false);
    expect(
      isPublishedSectionListCurrent(
        { pathname: '/about', regionId: 'about-mission' },
        '/about',
        null
      )
    ).toBe(false);
  });

  it('treats a missing regionId as the whole page', () => {
    // `undefined` means the publisher predates the field; the list must still be
    // adopted rather than silently dropped.
    expect(isPublishedSectionListCurrent({ pathname: '/about' }, '/about', null)).toBe(true);
  });
});
