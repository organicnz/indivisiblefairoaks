import { expect, test } from '@playwright/test';

test.describe('WALL-E assistant', () => {
  test('opens, sends a question, and renders grounded citations', async ({ page }) => {
    await page.route('**/api/wall-e-chat', async (route) => {
      const request = route.request();
      expect(request.method()).toBe('POST');
      const body = request.postDataJSON() as { message?: string; history?: unknown[] };
      expect(body.message).toBe('Where can I find voter information?');
      expect(Array.isArray(body.history)).toBe(true);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          answer: 'Visit the voter information page for registration and election resources.',
          citations: [{ title: 'Voter Information', url: '/voter-info' }],
        }),
      });
    });

    await page.goto('/');
    const openButton = page.getByRole('button', { name: 'Open WALL-E assistant' });
    await expect(openButton).toBeVisible();
    await openButton.click();

    await expect(page.getByRole('region', { name: 'WALL-E site assistant' })).toBeVisible();
    await page
      .getByRole('textbox', { name: 'Message WALL-E' })
      .fill('Where can I find voter information?');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(
      page.getByText('Visit the voter information page for registration and election resources.')
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Voter Information', exact: true })
    ).toHaveAttribute('href', '/voter-info');
  });
});
