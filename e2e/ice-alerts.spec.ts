import { expect, test } from '@playwright/test';

const MAP_LABEL = 'Interactive historical map of ICE arrests by city';

test.describe('ICE arrest city map', () => {
  test('shows the historical snapshot and renders the city circles', async ({ page }) => {
    await page.route('**/api/geo', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ available: false, reason: 'unavailable' }),
      })
    );
    await page.goto('/ice-alerts');

    const panel = page.locator('#ice-map-panel');
    const map = page.getByRole('region', { name: MAP_LABEL });
    const coverage = panel.getByRole('group', { name: 'Map coverage' });

    await expect(page.getByRole('heading', { level: 1, name: 'ICE arrests, mapped' })).toBeVisible();
    await expect(page.getByText(/Historical data, not a live alert map/)).toBeVisible();
    await expect(map).toBeVisible();
    await expect(panel.getByRole('heading', { level: 2, name: 'U.S. overview' })).toBeVisible();
    await expect(coverage.getByRole('button', { name: 'U.S. overview' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(panel.locator('#ice-location-status')).toContainText(
      'Showing the U.S. overview'
    );
    await expect(panel.getByRole('button', { name: 'Use precise location' })).toHaveCount(0);
    await expect(coverage.getByRole('button', { name: 'Locate me' })).toBeDisabled();
    await expect(panel.getByText('Clustered city map active')).toBeVisible();
    await expect(page.locator('.ice-cluster').first()).toBeVisible();
    await expect(page.locator('.ice-cluster').first()).toHaveText(/\d/);
    await expect(panel.getByText(/760,248/).first()).toBeVisible();
    await expect(panel.getByText(/8,599 city points/).first()).toBeVisible();
  });

  test('opens a cluster popup with a zoom action and documentation link', async ({ page }) => {
    await page.goto('/ice-alerts');

    const cluster = page.locator('.ice-cluster').first();
    await expect(cluster).toBeVisible();
    await cluster.click();

    const popup = page.locator('.ice-map-popup');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText(/nearby cities|City total/);
    await expect(popup.getByRole('button', { name: /Zoom in|Open context brief/ })).toBeVisible();
    await expect(popup.getByRole('link', { name: 'How this is documented' })).toHaveAttribute(
      'href',
      '#ice-case-documentation'
    );
  });

  test('selects a city and moves to a custom U.S. view', async ({ page }) => {
    await page.goto('/ice-alerts');

    const panel = page.locator('#ice-map-panel');
    await expect(panel.getByText('Clustered city map active')).toBeVisible();

    const conroe = page.getByRole('button', { name: /Conroe/ });
    await conroe.click();

    await expect(conroe).toHaveAttribute('aria-pressed', 'true');
    await expect(panel.getByRole('heading', { level: 2, name: 'Custom U.S. view' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Conroe, TX' })).toBeVisible();
    await expect(page.getByText('#1', { exact: true })).toBeVisible();
    await expect(page.locator('.ice-selected-city')).toHaveCount(1);
  });

  test('centers on an approximate area and can return to the U.S. overview', async ({ page }) => {
    await page.route('**/api/geo', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          available: true,
          lat: 38.5816,
          lng: -121.4944,
          label: 'Sacramento, CA',
          precision: 'approximate',
          source: 'vercel-ip',
        }),
      })
    );
    await page.goto('/ice-alerts');

    const panel = page.locator('#ice-map-panel');
    const coverage = panel.getByRole('group', { name: 'Map coverage' });
    const overview = coverage.getByRole('button', { name: 'U.S. overview' });
    const myArea = coverage.getByRole('button', { name: 'My area' });

    await expect(panel.getByText('Clustered city map active')).toBeVisible();
    await expect(panel.locator('#ice-location-status')).toContainText(
      'Approximate area: Sacramento, CA'
    );
    await expect(panel.getByRole('button', { name: 'Use precise location' })).toHaveCount(0);
    await expect(panel.getByRole('heading', { level: 2, name: 'Your area' })).toBeVisible();
    await expect(page.locator('.ice-user-location.is-approximate')).toHaveCount(1);
    await expect(myArea).toHaveAttribute('aria-pressed', 'true');
    await expect(overview).toHaveAttribute('aria-pressed', 'false');

    await overview.click();
    await expect(panel.getByRole('heading', { level: 2, name: 'U.S. overview' })).toBeVisible();
    await expect(overview).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.ice-user-location.is-approximate')).toHaveCount(1);

    await myArea.click();
    await expect(panel.getByRole('heading', { level: 2, name: 'Your area' })).toBeVisible();
    await expect(myArea).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.ice-cluster').first()).toBeVisible();
  });

  test('uses precise device location when permission is already granted', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 38.5816, longitude: -121.4944 });
    await page.route('**/api/geo', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ available: false, reason: 'unavailable' }),
      })
    );
    await page.goto('/ice-alerts');

    const panel = page.locator('#ice-map-panel');
    const coverage = panel.getByRole('group', { name: 'Map coverage' });

    await expect(panel.getByText('Using your current location')).toBeVisible();
    await expect(panel.getByRole('heading', { level: 2, name: 'Your area' })).toBeVisible();
    await expect(page.locator('.ice-user-location.is-precise')).toHaveCount(1);
    await expect(coverage.getByRole('button', { name: 'My area' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(panel.getByRole('button', { name: 'Refresh precise' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Use precise location' })).toHaveCount(0);
  });

  test('uses the approximate area when precise permission is denied', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator.permissions, 'query', {
        configurable: true,
        value: async () => ({ state: 'denied' }),
      });
    });
    await page.route('**/api/geo', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          available: true,
          lat: 38.5816,
          lng: -121.4944,
          label: 'Sacramento, CA',
          precision: 'approximate',
          source: 'vercel-ip',
        }),
      })
    );
    await page.goto('/ice-alerts');

    const panel = page.locator('#ice-map-panel');
    const coverage = panel.getByRole('group', { name: 'Map coverage' });

    await expect(panel.locator('#ice-location-status')).toContainText(
      'Approximate area: Sacramento, CA'
    );
    await expect(panel.getByRole('button', { name: 'Use precise location' })).toHaveCount(0);
    await expect(panel.getByText(/Precise location is blocked/)).toHaveCount(0);
    await expect(coverage.getByRole('button', { name: 'My area' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.locator('.ice-user-location.is-approximate')).toHaveCount(1);
  });

  test('searches a U.S. address without changing the snapshot', async ({ page }) => {
    let geocodeRequests = 0;
    await page.route(/^https:\/\/nominatim\.openstreetmap\.org\/search\?/, async (route) => {
      geocodeRequests += 1;
      const url = new URL(route.request().url());
      expect(url.searchParams.get('q')).toBe('350 5th Ave, New York, NY');
      expect(url.searchParams.get('countrycodes')).toBe('us');
      expect(url.searchParams.get('format')).toBe('jsonv2');
      expect(url.searchParams.get('limit')).toBe('1');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            lat: '40.7484',
            lon: '-73.9857',
            display_name: '350 5th Avenue, New York, New York County, New York, United States',
          },
        ]),
      });
    });

    await page.goto('/ice-alerts');
    const panel = page.locator('#ice-map-panel');
    const search = panel.getByRole('search', { name: 'Find a U.S. location on the city map' });

    await expect(panel.getByText('Clustered city map active')).toBeVisible();
    await search.getByLabel('Find a U.S. city or address').fill('350 5th Ave, New York, NY');
    await search.getByRole('button', { name: 'Search' }).click();

    await expect(search.getByRole('status')).toContainText('Moved map to 350 5th Avenue');
    await expect(page.locator('.ice-map-search-target')).toHaveCount(1);
    await expect(panel.getByRole('heading', { level: 2, name: 'Custom U.S. view' })).toBeVisible();
    await expect(page.locator('.leaflet-pane canvas')).toHaveCount(1);
    expect(geocodeRequests).toBe(1);
  });

  test('shows a clear no-results state without moving the map', async ({ page }) => {
    await page.route(/^https:\/\/nominatim\.openstreetmap\.org\/search\?/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      })
    );

    await page.goto('/ice-alerts');
    const panel = page.locator('#ice-map-panel');
    const search = panel.getByRole('search', { name: 'Find a U.S. location on the city map' });

    await expect(panel.getByText('Clustered city map active')).toBeVisible();
    await search.getByLabel('Find a U.S. city or address').fill('Nowhere, US');
    await search.getByRole('button', { name: 'Search' }).click();

    await expect(search.getByRole('status')).toContainText('No U.S. location found.');
    await expect(page.locator('.ice-map-search-target')).toHaveCount(0);
    await expect(panel.getByRole('heading', { level: 2, name: 'U.S. overview' })).toBeVisible();
    await expect(page.locator('.ice-cluster').first()).toBeVisible();
  });
});
