// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { galleryAltText } from '@/lib/gallery-alt';

describe('galleryAltText', () => {
  it('prefers the authored alt text over the visible caption', () => {
    expect(
      galleryAltText({
        alt: 'A crowd holding handmade signs outside the State Capitol',
        caption: 'No Kings at the Capitol',
      })
    ).toBe('A crowd holding handmade signs outside the State Capitol');
  });

  it('falls back to the caption for older rows without alt text', () => {
    expect(galleryAltText({ caption: 'March Across Tower Bridge' })).toBe(
      'March Across Tower Bridge'
    );
    expect(galleryAltText({ alt: '   ', caption: 'March Across Tower Bridge' })).toBe(
      'March Across Tower Bridge'
    );
  });

  it('never leaves a content image without an accessible name', () => {
    expect(galleryAltText({ alt: undefined, caption: '  ' })).toBe('Community photo');
  });
});
