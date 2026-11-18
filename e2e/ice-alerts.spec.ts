import { expect, test } from '@playwright/test';

const MAP_LABEL = 'Interactive historical map of ICE arrests by city';
const HISTORY_PATH = '/ice-alerts?view=history';

function rapidFeedFixture() {
  const now = Date.now();
  const recent = new Date(now - 35 * 60 * 1000).toISOString();
  const older = new Date(now - 70 * 60 * 1000).toISOString();

  return {
    generatedAt: new Date(now).toISOString(),
    community: {
      status: 'ok',
      sourceName: 'Stop ICE Alerts Network',
      sourceUrl: 'https://stopice.net/?data=1',
      checkedAt: new Date(now).toISOString(),
      latestAt: recent,
      itemCount: 3,
      note: 'Public nightly export. Locations are generalized to the nearest known city; raw details are withheld.',
    },
    official: {
      status: 'ok',
      sourceName: 'ICE Newsroom',
      sourceUrl: 'https://www.ice.gov/newsroom',
      checkedAt: new Date(now).toISOString(),
      latestAt: recent,
      itemCount: 1,
      note: 'Official agency releases from the ICE newsroom RSS feed. These are not live enforcement locations.',
    },
    alerts: [
      {
        id: 'test-santa-ana-1',
        source: 'community',
        sourceName: 'Stop ICE Alerts Network',
        sourceUrl: 'https://www.stopice.net/?alert=test-1',
        kind: 'detention',
        status: 'source-confirmed',
        title: 'Source-confirmed detention report',
        city: 'Santa Ana',
        stateCode: 'CA',
        place: 'Santa Ana, CA',
        lat: 33.73633,
        lng: -117.8829,
        observedAt: recent,
        expiresAt: new Date(now + 3 * 60 * 60 * 1000).toISOString(),
        summary:
          'Source-confirmed enforcement activity reported near a jail or detention facility in Santa Ana, CA. Location is generalized to the city; street addresses, vehicle plates, and identities are not republished.',
      },
      {
        id: 'test-santa-ana-2',
        source: 'community',
        sourceName: 'Stop ICE Alerts Network',
        sourceUrl: 'https://www.stopice.net/?alert=test-2',
        kind: 'enforcement',
        status: 'sighting',
        title: 'Community enforcement report',
        city: 'Santa Ana',
        stateCode: 'CA',
        place: 'Santa Ana, CA',
        lat: 33.73633,
        lng: -117.8829,
        observedAt: older,
        expiresAt: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
        summary:
          'Community sighting reported in Santa Ana, CA. Location is generalized to the city; street addresses, vehicle plates, and identities are not republished.',
      },
      {
        id: 'test-chicago-1',
        source: 'community',
        sourceName: 'Stop ICE Alerts Network',
        sourceUrl: 'https://www.stopice.net/?alert=test-3',
        kind: 'checkpoint',
        status: 'sighting',
        title: 'Community checkpoint report',
        city: 'Chicago',
        stateCode: 'IL',
        place: 'Chicago, IL',
        lat: 41.83705,
        lng: -87.68494,
        observedAt: recent,
        expiresAt: new Date(now + 3 * 60 * 60 * 1000).toISOString(),
        summary:
          'Community sighting reported near a possible checkpoint in Chicago, IL. Location is generalized to the city; street addresses, vehicle plates, and identities are not republished.',
      },
    ],
    officialReleases: [
      {
        id: 'ice-test-release',
        sourceName: 'ICE Newsroom',
        sourceUrl: 'https://www.ice.gov/news/releases/example',
        title: 'ICE publishes an official release',
        summary: 'An official agency release for context.',
        publishedAt: recent,
      },
    ],
    publicCases: [
      {
        id: 'public-sacramento-1',
        city: 'Sacramento',
        stateCode: 'CA',
        place: 'Sacramento, CA',
        kind: 'enforcement',
        observedAt: recent,
        summary:
          'Community report of enforcement activity in Sacramento, CA. City-level only; not independently verified.',
        lat: 38.5816,
        lng: -121.4944,
        corroborationCount: 2,
      },
    ],
  };
}

function mixedStatusRapidFeedFixture() {
  const fixture = rapidFeedFixture();
  const now = Date.now();
  const latest = new Date(now - 20 * 60 * 1000).toISOString();
  const older = new Date(now - 60 * 60 * 1000).toISOString();

  return {
    ...fixture,
    community: {
      ...fixture.community,
      latestAt: latest,
      itemCount: 3,
    },
    alerts: [
      {
        ...fixture.alerts[1],
        id: 'test-santa-ana-latest-sighting',
        kind: 'enforcement',
        status: 'sighting',
        title: 'Community enforcement report',
        observedAt: latest,
        expiresAt: new Date(now + 3 * 60 * 60 * 1000).toISOString(),
      },
      {
        ...fixture.alerts[0],
        id: 'test-santa-ana-older-confirmed',
        kind: 'detention',
        status: 'source-confirmed',
        title: 'Source-confirmed detention report',
        observedAt: older,
        expiresAt: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        ...fixture.alerts[2],
        id: 'test-chicago-1',
        observedAt: new Date(now - 25 * 60 * 1000).toISOString(),
        expiresAt: new Date(now + 3 * 60 * 60 * 1000).toISOString(),
      },
    ],
  };
}

async function mockRapidFeed(page: import('@playwright/test').Page, body = rapidFeedFixture()) {
  await page.route('**/api/geo', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ available: false, reason: 'unavailable' }),
    })
  );
  await page.route('**/api/ice-rapid', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  );
}

test.describe('ICE arrest city map', () => {
  test('shows the historical snapshot and renders the city circles', async ({ page }) => {
    await page.route('**/api/geo', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ available: false, reason: 'unavailable' }),
      })
    );
    await page.goto(HISTORY_PATH);

    const panel = page.locator('#ice-map-panel');
    const map = page.getByRole('region', { name: MAP_LABEL });
    const coverage = panel.getByRole('group', { name: 'Map coverage' });

    await expect(page.getByRole('heading', { level: 2, name: 'ICE arrests, mapped' })).toBeVisible();
    await expect(page.getByText(/Historical data, not a live alert map/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hide historical map' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
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
    await page.goto(HISTORY_PATH);

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
    await page.goto(HISTORY_PATH);

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
    await page.goto(HISTORY_PATH);

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
    await expect(panel.locator('.ice-user-location.is-approximate')).toHaveCount(1);
    await expect(myArea).toHaveAttribute('aria-pressed', 'true');
    await expect(overview).toHaveAttribute('aria-pressed', 'false');

    await overview.click();
    await expect(panel.getByRole('heading', { level: 2, name: 'U.S. overview' })).toBeVisible();
    await expect(overview).toHaveAttribute('aria-pressed', 'true');
    await expect(panel.locator('.ice-user-location.is-approximate')).toHaveCount(1);

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
    await page.goto(HISTORY_PATH);

    const panel = page.locator('#ice-map-panel');
    const coverage = panel.getByRole('group', { name: 'Map coverage' });

    await expect(panel.getByText('Using your current location')).toBeVisible();
    await expect(panel.getByRole('heading', { level: 2, name: 'Your area' })).toBeVisible();
    await expect(panel.locator('.ice-user-location.is-precise')).toHaveCount(1);
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
    await page.goto(HISTORY_PATH);

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
    await expect(panel.locator('.ice-user-location.is-approximate')).toHaveCount(1);
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

    await page.goto(HISTORY_PATH);
    const panel = page.locator('#ice-map-panel');
    const search = panel.getByRole('search', { name: 'Find a U.S. location on the city map' });

    await expect(panel.getByText('Clustered city map active')).toBeVisible();
    await search.getByLabel('Find a U.S. city or address').fill('350 5th Ave, New York, NY');
    await search.getByRole('button', { name: 'Search' }).click();

    await expect(search.getByRole('status')).toContainText('Moved map to 350 5th Avenue');
    await expect(page.locator('.ice-map-search-target')).toHaveCount(1);
    await expect(panel.getByRole('heading', { level: 2, name: 'Custom U.S. view' })).toBeVisible();
    await expect(page.locator('.leaflet-pane canvas')).toHaveCount(1);

    await expect.poll(() => new URL(page.url()).searchParams.get('foiaPin')).toBe(
      '40.7484,-73.9857'
    );
    expect(new URL(page.url()).searchParams.get('foiaQ')).toBe(
      '350 5th Ave, New York, NY'
    );
    expect(new URL(page.url()).searchParams.get('pin')).toBeNull();

    await page.reload();
    await expect(search.getByRole('status')).toContainText('Moved map to 350 5th Avenue');
    await expect(page.locator('.ice-map-search-target')).toHaveCount(1);
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

    await page.goto(HISTORY_PATH);
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

  test('restores a city from a shared URL', async ({ page }) => {
    await page.route('**/api/geo', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ available: false, reason: 'unavailable' }),
      })
    );
    await page.goto(`${HISTORY_PATH}&city=Conroe&state=TX`);

    const panel = page.locator('#ice-map-panel');
    const coverage = panel.getByRole('group', { name: 'Map coverage' });
    const conroe = page.getByRole('button', { name: /Conroe/ });

    await expect(page.getByRole('heading', { level: 2, name: 'Conroe, TX' })).toBeVisible();
    await expect(conroe).toHaveAttribute('aria-pressed', 'true');
    await expect(panel.getByRole('heading', { level: 2, name: 'Custom U.S. view' })).toBeVisible();
    await expect(page.getByText(/29,537/).first()).toBeVisible();
    await expect(page.getByText(/760,248/).first()).toBeVisible();
    await expect(coverage.getByRole('button', { name: 'U.S. overview' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  test('restores a shared search pin without re-geocoding', async ({ page }) => {
    let geocodeRequests = 0;
    await page.route(/^https:\/\/nominatim\.openstreetmap\.org\/search\?/, async (route) => {
      geocodeRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    });
    await page.route('**/api/geo', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ available: false, reason: 'unavailable' }),
      })
    );

    const shared = new URLSearchParams({
      pin: '40.7484,-73.9857',
      pinLabel: '350 5th Avenue, New York, New York County, New York, United States',
      q: '350 5th Ave, New York, NY',
      lat: '40.7484',
      lng: '-73.9857',
      z: '12',
    });
    await page.goto(`${HISTORY_PATH}&${shared.toString()}`);

    const panel = page.locator('#ice-map-panel');
    const search = panel.getByRole('search', { name: 'Find a U.S. location on the city map' });

    await expect(search.getByRole('status')).toContainText('Moved map to 350 5th Avenue');
    await expect(page.locator('.ice-map-search-target')).toHaveCount(1);
    await expect(panel.getByRole('heading', { level: 2, name: 'Custom U.S. view' })).toBeVisible();
    expect(geocodeRequests).toBe(0);

    await page.reload();
    await expect(search.getByRole('status')).toContainText('Moved map to 350 5th Avenue');
    await expect(page.locator('.ice-map-search-target')).toHaveCount(1);
    expect(geocodeRequests).toBe(0);
  });

  test('ignores URL fields that are not snapshot view state', async ({ page }) => {
    await page.route('**/api/geo', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ available: false, reason: 'unavailable' }),
      })
    );

    await page.goto(`${HISTORY_PATH}&city=Conroe&state=TX&count=1&records=1&report=invented`);
    const panel = page.locator('#ice-map-panel');
    const selected = page.locator('section[aria-labelledby="ice-selected-city-title"]');

    await expect(selected).toBeVisible();
    await expect(selected.getByText('29,537')).toBeVisible();
    await expect(panel.getByText(/760,248/).first()).toBeVisible();

    await page.goto(`${HISTORY_PATH}&city=Atlantis&state=ZZ&count=1&report=invented`);
    await expect(panel.getByRole('heading', { level: 2, name: 'U.S. overview' })).toBeVisible();
    await expect(page.getByText('Atlantis')).toHaveCount(0);
    await expect(page.getByText(/760,248/).first()).toBeVisible();
  });

  test('restores a shared map viewport', async ({ page }) => {
    await page.route('**/api/geo', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ available: false, reason: 'unavailable' }),
      })
    );
    await page.goto(`${HISTORY_PATH}&lat=38.5816&lng=-121.4944&z=7`);

    const panel = page.locator('#ice-map-panel');
    const coverage = panel.getByRole('group', { name: 'Map coverage' });

    await expect(panel.getByRole('heading', { level: 2, name: 'Custom U.S. view' })).toBeVisible();
    await expect(coverage.getByRole('button', { name: 'U.S. overview' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    const url = new URL(page.url());
    expect(url.searchParams.get('z')).toBe('7');
    expect(Number(url.searchParams.get('lat'))).toBeCloseTo(38.5816, 4);

    await page.reload();
    await expect(panel.getByRole('heading', { level: 2, name: 'Custom U.S. view' })).toBeVisible();
  });

  test('does not put an automatic approximate area into the URL', async ({ page }) => {
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
    await page.goto(HISTORY_PATH);

    const panel = page.locator('#ice-map-panel');
    await expect(panel.locator('#ice-location-status')).toContainText(
      'Approximate area: Sacramento, CA'
    );
    await expect(panel.getByRole('heading', { level: 2, name: 'Your area' })).toBeVisible();

    await expect.poll(() => new URL(page.url()).searchParams.has('lat')).toBe(false);
    await expect.poll(() => new URL(page.url()).searchParams.has('pin')).toBe(false);
  });
});

test.describe('ICE Alert national rapid-response dashboard', () => {
  test('renders live grouped pins, the pulsing rail, and the community feed', async ({ page }) => {
    await mockRapidFeed(page);
    await page.goto('/ice-alerts');

    await expect(page.getByRole('heading', { level: 1, name: 'ICE Alert' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Rapid response', exact: true })
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      page.getByRole('region', { name: 'Interactive national ICE rapid-response map' })
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'U.S. overview' })).toBeVisible();
    const liveRail = page.locator('section[aria-labelledby="ice-live-rail-title"]');
    await expect(liveRail.getByText('3 active', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent pulsing alerts' })).toBeVisible();

    const livePins = page.locator('.ice-rapid-marker.is-live');
    await expect(livePins.first()).toBeVisible({ timeout: 15_000 });
    await expect(livePins).toHaveCount(2);
    await expect(page.locator('.ice-rapid-marker__count').first()).toHaveText('2');
    await expect(page.locator('#ice-community-panel article')).toHaveCount(3);

    const santaAna = page
      .locator('#ice-community-panel')
      .getByRole('button', { name: /Santa Ana, CA/ })
      .first();
    await santaAna.click();

    const panel = page.locator('#ice-rapid-map-panel');
    await expect(panel.getByRole('heading', { name: 'Santa Ana, CA' })).toBeVisible();
    await expect(panel.getByText(/City centroid, not a street address/)).toBeVisible();
    await expect(panel.getByText(/identities are not republished/)).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get('alert')).toBe(
      'test-santa-ana-1'
    );
  });

  test('opens an on-map popup for a report pin', async ({ page }) => {
    await mockRapidFeed(page);
    await page.goto('/ice-alerts');

    const pin = page.locator('.ice-rapid-marker.is-live').first();
    await expect(pin).toBeVisible({ timeout: 15_000 });
    await pin.click();

    const popup = page.locator('#ice-rapid-map-panel .ice-map-popup');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('Santa Ana, CA');
    await expect(popup).toContainText('2 reports');

    await popup.getByRole('button', { name: 'View latest report' }).click();
    await expect(popup).toBeHidden();
    await expect(
      page.locator('#ice-rapid-map-panel').getByRole('heading', { name: 'Santa Ana, CA' })
    ).toBeVisible();
  });

  test('opens a popup from every rapid pin and from the FOIA overlay', async ({ page }) => {
    await mockRapidFeed(page, mixedStatusRapidFeedFixture());
    await page.goto('/ice-alerts');

    const markers = page.locator('.leaflet-marker-icon:has(.ice-rapid-marker)');
    const overview = page
      .getByRole('group', { name: 'Map coverage' })
      .getByRole('button', { name: 'U.S. overview' });
    await expect(markers).toHaveCount(2);
    await expect(markers.first()).toBeVisible({ timeout: 15_000 });

    const pinCount = await markers.count();
    let checkedMixedStatus = false;
    for (let index = 0; index < pinCount; index += 1) {
      const marker = markers.nth(index);
      const label = await marker.getAttribute('aria-label');
      const place = label?.split(':')[0] ?? '';
      expect(place).not.toBe('');

      await marker.locator('.ice-rapid-marker').click();

      const popup = page
        .locator('#ice-rapid-map-panel .ice-map-popup')
        .filter({ hasText: place });
      await expect(popup).toBeVisible();
      await expect(popup.locator('.ice-map-popup__title')).toHaveText(place);

      if (place === 'Santa Ana, CA') {
        checkedMixedStatus = true;
        await expect(marker.locator('.ice-rapid-marker')).toHaveClass(
          /ice-rapid-marker--confirmed/
        );
        await expect(popup.locator('.ice-map-popup__rank').first()).toHaveText(
          /^Latest report: Sighting enforcement · /
        );
        await expect(popup.locator('.ice-map-popup__rank--strongest')).toHaveText(
          'Strongest source status in this city: Source-confirmed'
        );
        await expect(popup).not.toContainText('Source-confirmed enforcement · Latest');
      }

      await overview.click();
      if (index + 1 < pinCount) {
        await expect(markers.nth(index + 1)).toBeInViewport();
      }
    }
    expect(checkedMixedStatus).toBe(true);

    await page.getByRole('button', { name: 'FOIA context' }).click();

    const foiaMarker = page.locator('.ice-historical-city[data-city="Conroe"]');
    await expect(foiaMarker).toBeVisible();
    await foiaMarker.click();

    const foiaPopup = page
      .locator('#ice-rapid-map-panel .ice-map-popup')
      .filter({ hasText: 'FOIA context' });
    await expect(foiaPopup).toBeVisible();
    await expect(foiaPopup).toContainText('FOIA context');
    await expect(foiaPopup).toContainText('Conroe, TX');
    await expect(foiaPopup).toContainText('29,537 records');
  });

  test('opens a Supabase-backed popup for a published community case', async ({ page }) => {
    await mockRapidFeed(page);
    await page.goto('/ice-alerts');

    const caseMarker = page.locator('.ice-public-case-marker');
    await expect(caseMarker).toHaveCount(1);
    await caseMarker.click();

    const popup = page.locator('#ice-rapid-map-panel .ice-map-popup');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('Published community case');
    await expect(popup).toContainText('Sacramento, CA');
    await expect(popup).toContainText('Enforcement');
    await expect(popup).toContainText('Combined from 2 reports');
    await expect(popup.getByRole('link', { name: 'Read all community reports' })).toHaveAttribute(
      'href',
      '#reviewed-reports'
    );
  });

  test('keeps official releases separate from community pins', async ({ page }) => {
    await mockRapidFeed(page);
    await page.goto('/ice-alerts');

    await expect(
      page
        .locator('section[aria-labelledby="ice-live-rail-title"]')
        .getByText('3 active', { exact: true })
    ).toBeVisible();
    await page.getByRole('tab', { name: /Official/ }).click();

    const officialPanel = page.locator('#ice-official-panel');
    await expect(officialPanel.getByText('Official ICE release')).toBeVisible();
    await expect(officialPanel.getByText('ICE publishes an official release')).toBeVisible();
    await expect(
      officialPanel.getByRole('link', { name: /Read the official release/ })
    ).toHaveAttribute('href', 'https://www.ice.gov/news/releases/example');
    await expect(page.locator('.ice-rapid-marker')).toHaveCount(2);
  });

  test('labels older reports instead of presenting them as active', async ({ page }) => {
    const fixture = rapidFeedFixture();
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const stale = {
      ...fixture,
      alerts: fixture.alerts.map((alert) => ({
        ...alert,
        observedAt: old,
        expiresAt: new Date(Date.parse(old) + 4 * 60 * 60 * 1000).toISOString(),
      })),
      community: {
        ...fixture.community,
        status: 'stale',
        latestAt: old,
        note: 'The public export has not published a newer report.',
      },
    };

    await mockRapidFeed(page, stale);
    await page.goto('/ice-alerts');

    await expect(
      page.getByText('No active community reports in the last 4 hours.')
    ).toBeVisible();
    await expect(page.locator('.ice-rapid-marker.is-live')).toHaveCount(0);
    await expect(page.locator('.ice-rapid-marker').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#ice-community-panel').getByText('Earlier').first()).toBeVisible();
  });

  test('keeps the map usable and offers the historical view when the feed fails', async ({
    page,
  }) => {
    await page.route('**/api/geo', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ available: false, reason: 'unavailable' }),
      })
    );
    await page.route('**/api/ice-rapid', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unavailable' }),
      })
    );

    await page.goto('/ice-alerts');

    await expect(
      page.getByText(/The rapid-response feed is temporarily unavailable/)
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'U.S. overview' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Historical map' })).toHaveAttribute(
      'href',
      '#historical-foia'
    );
  });

  test('restores a shared alert selection and keeps the historical map reachable', async ({
    page,
  }) => {
    await mockRapidFeed(page);
    await page.goto('/ice-alerts?alert=test-chicago-1&lat=39&lng=-98&z=5');

    const panel = page.locator('#ice-rapid-map-panel');
    await expect(panel.getByRole('heading', { name: 'Chicago, IL' })).toBeVisible({
      timeout: 15_000,
    });
    await expect.poll(() => new URL(page.url()).searchParams.get('alert')).toBe(
      'test-chicago-1'
    );

    const historicalLink = page.getByRole('link', { name: 'Historical FOIA', exact: true });
    await expect(historicalLink).toHaveAttribute('href', '#historical-foia');
    await expect(page.getByRole('button', { name: 'Explore historical map' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    await expect(page.locator('#historical-foia-panel')).toBeHidden();
    await historicalLink.click();
    await expect(page.getByRole('heading', { level: 1, name: 'ICE Alert' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'ICE arrests, mapped' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hide historical map' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await expect(page.locator('#historical-foia')).toBeVisible();
  });

  test('offers a private reunification request without publishing identities', async ({
    page,
    request,
  }) => {
    await page.goto('/ice-alerts/reunification');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Family reunification' })
    ).toBeVisible();
    await expect(
      page.getByText(/Names, photos, and case details are never shown on the map\./)
    ).toBeVisible();
    await expect(page.getByLabel('Your name')).toBeVisible();
    await expect(page.getByLabel('Full name used in custody')).toBeVisible();
    await expect(
      page.getByLabel(/I understand this is a private request/)
    ).toBeVisible();

    const invalid = await request.post('/api/ice-reunification', {
      multipart: { submitter_name: 'A' },
    });
    expect(invalid.status()).toBe(400);
  });
});
