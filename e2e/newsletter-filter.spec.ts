import { expect, type Page, test } from '@playwright/test';

type FilterLayout = {
  searchWidth: number;
  searchTop: number;
  searchToPanelRatio: number;
  groupTop: number;
  groupSlack: number;
  panelHeight: number;
};

/**
 * Read the boxes that define the archive filter's row contract.
 *
 * `groupSlack` is the unused width inside the topic column. A healthy desktop
 * layout sizes that column to its chips; a forced flex-basis leaves a large
 * empty tail and squeezes the search field.
 */
async function readFilterLayout(page: Page): Promise<FilterLayout> {
  return page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('[data-testid="newsletter-search"]');
    const panel = document.querySelector<HTMLElement>('[data-testid="newsletter-filter-panel"]');
    const group = panel?.querySelector<HTMLElement>(
      '[role="group"][aria-label="Filter bulletins by topic"]'
    );

    if (!input || !panel || !group) {
      throw new Error(
        'The newsletter filter bar did not render its search, panel, and topic group.'
      );
    }

    const search = input.getBoundingClientRect();
    const panelBox = panel.getBoundingClientRect();
    const groupBox = group.getBoundingClientRect();
    const chips = [...group.querySelectorAll<HTMLElement>('button')].filter(
      (chip) => chip.getClientRects().length > 0
    );
    const contentRight = chips.length
      ? Math.max(...chips.map((chip) => chip.getBoundingClientRect().right))
      : groupBox.left;

    return {
      searchWidth: search.width,
      searchTop: search.top,
      searchToPanelRatio: search.width / panelBox.width,
      groupTop: groupBox.top,
      groupSlack: groupBox.width - (contentRight - groupBox.left),
      panelHeight: panelBox.height,
    };
  });
}

test.describe('/newsletters filter layout', () => {
  test('desktop keeps the search field wide when the topic list is short', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/newsletters');

    await expect(page.getByTestId('newsletter-search')).toBeVisible();
    const group = page.getByRole('group', { name: 'Filter bulletins by topic' });
    await expect(group).toBeVisible();

    /*
     * The seeded archive has enough topics to fill the old forced 2fr column,
     * which is why the regression was not obvious. Reduce it to the All Topics
     * chip — the state a new or short archive has — so the desktop invariant is
     * tested against the condition that exposed it.
     */
    await group.evaluate((element) => {
      for (const button of [...element.querySelectorAll('button')].slice(1)) {
        button.remove();
      }
    });

    const layout = await readFilterLayout(page);
    expect(layout.searchWidth).toBeGreaterThanOrEqual(480);
    expect(layout.searchToPanelRatio).toBeGreaterThanOrEqual(0.5);
    expect(layout.groupSlack).toBeLessThanOrEqual(40);
    expect(layout.panelHeight).toBeLessThanOrEqual(160);
  });

  test('mobile stacks the search field above the topic chips at full width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/newsletters');

    await expect(page.getByTestId('newsletter-search')).toBeVisible();
    const layout = await readFilterLayout(page);

    expect(layout.searchWidth).toBeGreaterThanOrEqual(280);
    expect(layout.searchToPanelRatio).toBeGreaterThanOrEqual(0.8);
    expect(layout.searchTop).toBeLessThan(layout.groupTop);
  });
});
