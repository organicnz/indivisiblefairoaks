import { expect, test, type Page } from '@playwright/test';

const MAP_LABEL = 'Interactive sample alert map';

type PinPosition = {
  label: string;
  inMap: boolean;
  hidden: boolean;
  tabIndex: number;
};

/**
 * Read the map's rendered pin positions.
 *
 * Leaflet keeps off-screen pins in the DOM at large translated coordinates, so
 * `toBeVisible()` alone would pass for every national pin even while the map is
 * still showing only Sacramento. The meaningful browser question is whether
 * the pin's box is inside the map viewport.
 */
async function readPinPositions(page: Page): Promise<PinPosition[]> {
  return page.evaluate((mapLabel) => {
    const map = document.querySelector<HTMLElement>(`[aria-label="${mapLabel}"]`);
    if (!map) throw new Error(`Map region "${mapLabel}" was not rendered`);

    const mapRect = map.getBoundingClientRect();
    return [...map.querySelectorAll<HTMLElement>('.ice-map-marker')].map((pin) => {
      const pinRect = pin.getBoundingClientRect();
      return {
        label: pin.getAttribute('aria-label') ?? '',
        inMap:
          pinRect.left >= mapRect.left &&
          pinRect.right <= mapRect.right &&
          pinRect.top >= mapRect.top &&
          pinRect.bottom <= mapRect.bottom,
        hidden: pin.getAttribute('aria-hidden') === 'true',
        tabIndex: pin.tabIndex,
      };
    });
  }, MAP_LABEL);
}

test.describe('ICE alerts map', () => {
  test('opens on the broader Sacramento view', async ({ page }) => {
    await page.goto('/ice-alerts');

    const panel = page.locator('#ice-map-panel');
    const map = page.getByRole('region', { name: MAP_LABEL });
    const coverage = panel.getByRole('group', { name: 'Map coverage' });
    const sacramento = coverage.getByRole('button', { name: 'Sacramento' });
    const nationwide = coverage.getByRole('button', { name: 'Nationwide' });

    await expect(map).toBeVisible();
    await expect(panel.getByRole('heading', { level: 2, name: 'Sacramento region' })).toBeVisible();
    await expect(sacramento).toHaveAttribute('aria-pressed', 'true');
    await expect(nationwide).toHaveAttribute('aria-pressed', 'false');
    await expect(panel.getByText('Regional overview', { exact: true })).toBeVisible();

    // Wait for Leaflet's dynamically imported markers before measuring the
    // initial viewport.
    await expect(page.locator('.ice-map-marker')).toHaveCount(9);

    const pins = await readPinPositions(page);
    const regional = pins.filter((pin) => /^Report [1-5]:/.test(pin.label));
    const national = pins.filter((pin) => /^Report [6-9]:/.test(pin.label));

    expect(regional).toHaveLength(5);
    expect(regional.every((pin) => pin.inMap)).toBe(true);
    expect(regional.every((pin) => !pin.hidden && pin.tabIndex === 0)).toBe(true);
    expect(national).toHaveLength(4);
    expect(national.every((pin) => !pin.inMap)).toBe(true);
    // Off-screen markers stay in Leaflet's DOM; they must not stay in the tab
    // order or the accessibility tree while the map shows Sacramento.
    expect(national.every((pin) => pin.hidden && pin.tabIndex === -1)).toBe(true);
  });

  test('Nationwide fits the lower 48 and activates the national pins', async ({ page }) => {
    await page.goto('/ice-alerts');

    const panel = page.locator('#ice-map-panel');
    const map = page.getByRole('region', { name: MAP_LABEL });
    const coverage = panel.getByRole('group', { name: 'Map coverage' });
    const nationwide = coverage.getByRole('button', { name: 'Nationwide' });

    await expect(map).toBeVisible();
    await expect(page.locator('.ice-map-marker')).toHaveCount(9);

    await nationwide.click();

    await expect(panel.getByRole('heading', { level: 2, name: 'Nationwide view' })).toBeVisible();
    await expect(nationwide).toHaveAttribute('aria-pressed', 'true');
    await expect(
      coverage.getByRole('button', { name: 'Sacramento' })
    ).toHaveAttribute('aria-pressed', 'false');
    await expect(panel.getByText('Lower 48 overview', { exact: true })).toBeVisible();

    // fitBounds animates for 400ms. Wait for every pin to land inside the map,
    // which proves the viewport is the lower-48 overview rather than a
    // Sacramento-sized window with the national pins merely in the DOM.
    await expect
      .poll(async () => {
        const pins = await readPinPositions(page);
        return pins
          .filter((pin) => !pin.inMap || pin.hidden || pin.tabIndex !== 0)
          .map((pin) => pin.label);
      })
      .toEqual([]);

    const losAngeles = page.getByRole('button', {
      name: /^Report 6: Enforcement activity at Los Angeles, CA/,
    });
    await expect(losAngeles).toBeVisible();
    await losAngeles.click();

    await expect(losAngeles).toHaveAttribute('aria-pressed', 'true');
    await expect(
      panel.getByRole('heading', { level: 3, name: 'Los Angeles, CA' })
    ).toBeVisible();
  });

  test('searches a U.S. address, moves the map, and does not add a report', async ({ page }) => {
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
    const search = panel.getByRole('search', { name: 'Find a U.S. location on the map' });

    await expect(page.locator('.ice-map-marker')).toHaveCount(9);
    await search.getByLabel('Find a U.S. city or address').fill('350 5th Ave, New York, NY');
    await search.getByRole('button', { name: 'Search' }).click();

    await expect(search.getByRole('status')).toContainText('Moved map to 350 5th Avenue');
    await expect(page.locator('.ice-map-search-target')).toHaveCount(1);
    await expect(panel.getByRole('heading', { level: 2, name: 'Custom U.S. view' })).toBeVisible();

    // The New York sample pin proves the map moved to the result, while the
    // report count staying at nine proves the search did not create a report.
    await expect
      .poll(async () => {
        const pins = await readPinPositions(page);
        const newYork = pins.find((pin) => pin.label.startsWith('Report 9:'));
        return Boolean(newYork?.inMap && !newYork.hidden && newYork.tabIndex === 0);
      })
      .toBe(true);
    await expect(page.locator('.ice-map-marker')).toHaveCount(9);
    expect(geocodeRequests).toBe(1);
  });

  test('shows a clear no-results state without moving or adding a report', async ({ page }) => {
    await page.route(/^https:\/\/nominatim\.openstreetmap\.org\/search\?/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      })
    );

    await page.goto('/ice-alerts');
    const panel = page.locator('#ice-map-panel');
    const search = panel.getByRole('search', { name: 'Find a U.S. location on the map' });

    await expect(page.locator('.ice-map-marker')).toHaveCount(9);
    await search.getByLabel('Find a U.S. city or address').fill('Nowhere, US');
    await search.getByRole('button', { name: 'Search' }).click();

    await expect(search.getByRole('status')).toContainText('No U.S. location found.');
    await expect(page.locator('.ice-map-search-target')).toHaveCount(0);
    await expect(panel.getByRole('heading', { level: 2, name: 'Sacramento region' })).toBeVisible();
    await expect(page.locator('.ice-map-marker')).toHaveCount(9);
  });
});
