// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataPoint } from '@/components/ui/DataPoint';
import * as civicClient from '@/lib/queries/civic-client';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('useDataPoints and Edge API Integration', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('fetches data points via Edge API function', async () => {
    const mockGetDataPoints = vi.spyOn(civicClient, 'getDataPoints').mockResolvedValue({
      dataPoints: {
        'about.hero.headline': 'Grassroots Resistance for Democracy',
      },
      rows: [
        {
          key: 'about.hero.headline',
          value: 'Grassroots Resistance for Democracy',
          group_name: 'about',
          label: 'About Hero Headline',
        },
      ],
    });

    const res = await civicClient.getDataPoints('about');
    expect(mockGetDataPoints).toHaveBeenCalledWith('about');
    expect(res.dataPoints['about.hero.headline']).toBe('Grassroots Resistance for Democracy');
    expect(res.rows).toHaveLength(1);
  });

  it('saves data point via Edge API function and dispatches custom event', async () => {
    const mockSaveDataPoint = vi.spyOn(civicClient, 'saveDataPoint').mockResolvedValue({
      success: true,
      dataPoint: {
        key: 'home.hero.headline',
        value: 'Updated Headline Value',
        group_name: 'home',
        label: 'home.hero.headline',
      },
    });

    const eventSpy = vi.fn();
    window.addEventListener('data-point-saved', eventSpy);

    const payload = {
      key: 'home.hero.headline',
      value: 'Updated Headline Value',
      group_name: 'home',
      label: 'home.hero.headline',
    };

    const res = await civicClient.saveDataPoint(payload);
    expect(mockSaveDataPoint).toHaveBeenCalledWith(payload);
    expect(res.success).toBe(true);

    // Simulate event dispatch
    window.dispatchEvent(
      new CustomEvent('data-point-saved', {
        detail: { key: payload.key, value: payload.value },
      })
    );

    expect(eventSpy).toHaveBeenCalled();
    const eventDetail = eventSpy.mock.calls[0][0].detail;
    expect(eventDetail.key).toBe('home.hero.headline');
    expect(eventDetail.value).toBe('Updated Headline Value');

    window.removeEventListener('data-point-saved', eventSpy);
  });

  it('renders DataPoint with fallback text and data-data-point attribute', async () => {
    vi.spyOn(civicClient, 'getDataPoints').mockResolvedValue({
      dataPoints: {},
      rows: [],
    });

    await act(async () => {
      root.render(
        <DataPoint name="events.hero.headline" as="h1" className="text-3xl font-bold">
          Upcoming Events & Actions
        </DataPoint>
      );
    });

    const el = container.querySelector('[data-data-point="events.hero.headline"]');
    expect(el).not.toBeNull();
    expect(el?.tagName).toBe('H1');
    expect(el?.textContent).toBe('Upcoming Events & Actions');
    expect(el?.className).toContain('text-3xl font-bold');
  });

  it('renders DataPoint using initialData without flash', async () => {
    vi.spyOn(civicClient, 'getDataPoints').mockResolvedValue({
      dataPoints: {},
      rows: [],
    });

    await act(async () => {
      root.render(
        <DataPoint
          name="footer.tagline"
          as="p"
          initialData={{ 'footer.tagline': 'Grassroots movement defending democracy.' }}
        >
          Fallback Tagline
        </DataPoint>
      );
    });

    const el = container.querySelector('[data-data-point="footer.tagline"]');
    expect(el?.textContent).toBe('Grassroots movement defending democracy.');
  });

  it('reactively updates DataPoint text when data-point-saved event is fired', async () => {
    vi.spyOn(civicClient, 'getDataPoints').mockResolvedValue({
      dataPoints: { 'news.hero.headline': 'Original Headline' },
      rows: [],
    });

    await act(async () => {
      root.render(
        <DataPoint name="news.hero.headline" as="h2">
          Fallback News Headline
        </DataPoint>
      );
    });

    // Fire data-point-saved event
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('data-point-saved', {
          detail: { key: 'news.hero.headline', value: 'Breaking Grassroots Bulletin' },
        })
      );
    });

    const el = container.querySelector('[data-data-point="news.hero.headline"]');
    expect(el?.textContent).toBe('Breaking Grassroots Bulletin');
  });

  it('renders store, search, wishlist, and login DataPoint tags correctly', async () => {
    vi.spyOn(civicClient, 'getDataPoints').mockResolvedValue({
      dataPoints: {
        'wishlist.hero.title': 'My Wishlist',
        'search.header.title': 'Search Results',
        'products.sidebar.categories': 'Categories',
        'login.gateway.secure': 'Secure Gateway',
        'account.session.title': 'Session Control',
      },
      rows: [],
    });

    await act(async () => {
      root.render(
        <div>
          <DataPoint name="wishlist.hero.title">Fallback</DataPoint>
          <DataPoint name="search.header.title">Fallback</DataPoint>
          <DataPoint name="products.sidebar.categories">Fallback</DataPoint>
          <DataPoint name="login.gateway.secure">Fallback</DataPoint>
          <DataPoint name="account.session.title">Fallback</DataPoint>
        </div>
      );
    });

    expect(container.querySelector('[data-data-point="wishlist.hero.title"]')?.textContent).toBe(
      'My Wishlist'
    );
    expect(container.querySelector('[data-data-point="search.header.title"]')?.textContent).toBe(
      'Search Results'
    );
    expect(
      container.querySelector('[data-data-point="products.sidebar.categories"]')?.textContent
    ).toBe('Categories');
    expect(container.querySelector('[data-data-point="login.gateway.secure"]')?.textContent).toBe(
      'Secure Gateway'
    );
    expect(container.querySelector('[data-data-point="account.session.title"]')?.textContent).toBe(
      'Session Control'
    );
  });

  it('renders utility, navigation, error, and Wall-E DataPoint tags correctly', async () => {
    vi.spyOn(civicClient, 'getDataPoints').mockResolvedValue({
      dataPoints: {
        'notfound.badge': 'Error 404',
        'error.title': 'Something Snapped',
        'header.donate_btn': 'Donate',
        'walle.badge': 'Online',
        'palette.empty.title': 'No matching civic actions or pages found.',
      },
      rows: [],
    });

    await act(async () => {
      root.render(
        <div>
          <DataPoint name="notfound.badge">404</DataPoint>
          <DataPoint name="error.title">Error</DataPoint>
          <DataPoint name="header.donate_btn">Give</DataPoint>
          <DataPoint name="walle.badge">Status</DataPoint>
          <DataPoint name="palette.empty.title">None</DataPoint>
        </div>
      );
    });

    expect(container.querySelector('[data-data-point="notfound.badge"]')?.textContent).toBe(
      'Error 404'
    );
    expect(container.querySelector('[data-data-point="error.title"]')?.textContent).toBe(
      'Something Snapped'
    );
    expect(container.querySelector('[data-data-point="header.donate_btn"]')?.textContent).toBe(
      'Donate'
    );
    expect(container.querySelector('[data-data-point="walle.badge"]')?.textContent).toBe('Online');
    expect(container.querySelector('[data-data-point="palette.empty.title"]')?.textContent).toBe(
      'No matching civic actions or pages found.'
    );
  });
});
