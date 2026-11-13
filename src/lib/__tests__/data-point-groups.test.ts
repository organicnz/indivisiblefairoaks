// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { dataPointGroup } from '@/lib/data-point-groups';

describe('dataPointGroup', () => {
  it('maps singular key prefixes to their plural table groups', () => {
    expect(dataPointGroup('link.aclu-norcal.name')).toBe('links');
    expect(dataPointGroup('faq.choir-audition.answer')).toBe('faqs');
    expect(dataPointGroup('partner.aclu-norcal.description')).toBe('partners');
  });

  it('accepts an already-normalized group and leaves ordinary groups alone', () => {
    expect(dataPointGroup('links')).toBe('links');
    expect(dataPointGroup('partners')).toBe('partners');
    expect(dataPointGroup('home')).toBe('home');
  });
});
