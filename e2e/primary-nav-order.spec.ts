import { expect, test } from '@playwright/test';

test('Main leads the primary nav and appears before About in the mobile drawer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const primary = page.getByRole('navigation', { name: 'Primary' });
  const firstPrimaryItem = primary.locator(':scope > a, :scope > button').first();
  await expect(firstPrimaryItem).toHaveText('Main');
  await expect(firstPrimaryItem).toHaveAttribute('href', '/');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation menu' }).click();

  const drawer = page.getByRole('navigation', { name: 'Mobile' });
  await expect(drawer).toBeVisible();
  const mobileOrder = await drawer.locator('a').evaluateAll((links) =>
    links
      .map((link) => (link.textContent ?? '').trim())
      .filter((label) => label === 'Main' || label === 'About')
  );
  expect(mobileOrder).toEqual(['Main', 'About']);
});
