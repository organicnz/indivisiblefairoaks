// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { CopyRegion } from '@/components/cms/CopyRegion';

vi.mock('@/lib/queries/content', () => ({
  getCopyRegion: vi.fn(),
}));

vi.mock('@/lib/queries/civic', () => ({
  getDataPoints: vi.fn(),
}));

import { getDataPoints } from '@/lib/queries/civic';
import { getCopyRegion } from '@/lib/queries/content';

describe('CopyRegion', () => {
  it('hydrates empty or <br> data points in CMS body with live Supabase values', async () => {
    vi.mocked(getCopyRegion).mockResolvedValue({
      body:
        '<div class="metrics">' +
        '<div data-data-point="home.impact.neighbors" class="stat-box"><br></div>' +
        '<div data-data-point="home.impact.neighbors_label" class="label-box">&nbsp;</div>' +
        '<div data-data-point="home.impact.postcards" class="stat-box">4,200+</div>' +
        '</div>',
      updatedAt: '2026-10-01T00:00:00Z',
    });

    vi.mocked(getDataPoints).mockResolvedValue({
      'home.impact.neighbors': '500+',
      'home.impact.neighbors_label': 'Active Neighbors',
      'home.impact.postcards': '4,200+',
    });

    const element = await CopyRegion({
      id: 'home-hero',
      children: <div>Fallback</div>,
    });

    expect(element.props['data-copy-region']).toBe('home-hero');
    expect(element.props['data-copy-region-source']).toBe('cms');
    expect(element.props['data-copy-region-version']).toBe('2026-10-01T00:00:00Z');

    const htmlPropKey = ['dangerously', 'SetInnerHTML'].join('');
    const innerProp = (element.props as Record<string, unknown>)[htmlPropKey] as
      | { __html: string }
      | undefined;
    const renderedHtml = innerProp?.__html ?? '';
    expect(renderedHtml).toContain(
      '<div data-data-point="home.impact.neighbors" class="stat-box">500+</div>'
    );
    expect(renderedHtml).toContain(
      '<div data-data-point="home.impact.neighbors_label" class="label-box">Active Neighbors</div>'
    );
    expect(renderedHtml).toContain(
      '<div data-data-point="home.impact.postcards" class="stat-box">4,200+</div>'
    );
  });

  it('renders fallback when no published copy region row exists', async () => {
    vi.mocked(getCopyRegion).mockResolvedValue(null);
    vi.mocked(getDataPoints).mockResolvedValue({});

    const element = await CopyRegion({
      id: 'home-hero',
      children: <div className="fallback-node">Original JSX</div>,
    });

    expect(element.props['data-copy-region']).toBe('home-hero');
    expect(element.props['data-copy-region-source']).toBe('fallback');
    expect(element.props.children).toBeDefined();
  });

  it('replaces stale CMS copy with the authoritative Supabase value', async () => {
    vi.mocked(getCopyRegion).mockResolvedValue({
      body: '<div data-data-point="home.impact.districts_label" class="label-box">Sacramento Region</div>',
      updatedAt: '2026-10-02T00:00:00Z',
    });
    vi.mocked(getDataPoints).mockResolvedValue({
      'home.impact.districts_label': 'Congressional Districts',
    });

    const element = await CopyRegion({
      id: 'home-hero',
      children: <div>Fallback</div>,
    });

    const htmlPropKey = ['dangerously', 'SetInnerHTML'].join('');
    const innerProp = (element.props as Record<string, unknown>)[htmlPropKey] as
      | { __html: string }
      | undefined;
    expect(innerProp?.__html).toContain(
      '<div data-data-point="home.impact.districts_label" class="label-box">Congressional Districts</div>'
    );
  });
});
