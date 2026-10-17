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

    // The panel is a Radix dialog (focus trap, Escape, scroll lock, focus restore)
    // rather than a bare labelled <section>, so its role is `dialog` and the
    // accessible name comes from the visually-hidden DialogTitle.
    const panel = page.getByRole('dialog', { name: 'WALL-E site assistant' });
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('walle-avatar').first()).toBeVisible();
    await page
      .getByRole('textbox', { name: 'Message WALL-E' })
      .fill('Where can I find voter information?');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(
      page.getByText('Visit the voter information page for registration and election resources.')
    ).toBeVisible();
    await expect(panel.getByRole('link', { name: /Voter Information/ })).toHaveAttribute(
      'href',
      '/voter-info'
    );

    // Closing the dialog via Dialog.Close in the dialog header
    const closeButton = panel.getByRole('button', { name: 'Close WALL-E' });
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await expect(panel).not.toBeVisible();
  });
});
