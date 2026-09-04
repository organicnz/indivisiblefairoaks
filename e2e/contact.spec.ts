import { type APIRequestContext, expect, test } from '@playwright/test';

const MOCK = 'http://127.0.0.1:3101';

async function setMockMode(request: APIRequestContext, mode: Record<string, unknown>) {
  await request.post(`${MOCK}/__mode`, { data: mode });
}

async function getMockState(request: APIRequestContext) {
  return request.get(`${MOCK}/__mode`).then((r) => r.json());
}

async function fillAndSubmit(page: import('@playwright/test').Page, opts: { copy?: boolean } = {}) {
  await page.goto('/contact');
  await page.getByLabel('Full Name').fill('E2E Tester');
  await page.getByLabel('Email Address').fill('e2e-tester@indivisiblefairoaks.org');
  await page
    .getByLabel('Message', { exact: true })
    .fill('Automated end-to-end verification of the contact delivery status flow.');
  if (opts.copy) await page.getByLabel(/send me a copy/i).check();
  await page.getByRole('button', { name: /send message/i }).click();
}

test.beforeEach(async ({ request }) => {
  await setMockMode(request, { reset: true });
  await request.post(`${MOCK}/__reset`);
});

test.describe('contact form delivery status', () => {
  test('full success with sender copy shows confirmation and hits the notify function', async ({
    page,
    request,
  }) => {
    await fillAndSubmit(page, { copy: true });

    const banner = page.getByRole('status');
    await expect(banner).toContainText(/message sent successfully/i);
    await expect(banner).toContainText('e2e-tester@indivisiblefairoaks.org');

    const state = await getMockState(request);
    expect(state.calls).toBe(1);
  });

  test('success without the copy option never promises a copy email', async ({ page, request }) => {
    await fillAndSubmit(page);

    const banner = page.getByRole('status');
    await expect(banner).toContainText(/message sent successfully/i);
    await expect(banner).not.toContainText(/copy/i);
    expect((await getMockState(request)).calls).toBe(1);
  });

  test('failed sender copy surfaces an honest partial-success banner', async ({
    page,
    request,
  }) => {
    await setMockMode(request, { copied: false });
    await fillAndSubmit(page, { copy: true });

    const banner = page.getByRole('status');
    await expect(banner).toContainText(/message sent/i);
    await expect(banner).toContainText(/could not be delivered/i);
    expect((await getMockState(request)).calls).toBe(1);
  });

  test('failed admin notification surfaces the fallback-contact banner', async ({
    page,
    request,
  }) => {
    await setMockMode(request, { emailed: false, copied: false });
    await fillAndSubmit(page, { copy: true });

    const banner = page.getByRole('status');
    await expect(banner).toContainText(/notification email failed/i);
    await expect(
      banner.getByRole('link', { name: /contact@indivisiblefairoaks\.org/i })
    ).toBeVisible();

    // The message was still stored — exactly one notification attempt made.
    expect((await getMockState(request)).calls).toBe(1);
  });

  test('function errors (502) are treated as delivery failure, not a crash', async ({
    page,
    request,
  }) => {
    await setMockMode(request, { status: 502, emailed: false, copied: false });
    await fillAndSubmit(page);

    await expect(page.getByRole('status')).toContainText(/notification email failed/i);
  });

  test('honeypot submissions fake success without ever calling the function', async ({
    page,
    request,
  }) => {
    await page.goto('/contact');
    // Honeypot is visually hidden; fill() refuses hidden inputs even forced,
    // so set the DOM value directly like a naive bot would.
    await page.locator('#website').evaluate((el) => {
      (el as HTMLInputElement).value = 'http://spam.example';
    });
    await page.getByLabel('Full Name').fill('Bot McBotface');
    await page.getByLabel('Email Address').fill('bot@example.com');
    await page
      .getByLabel('Message', { exact: true })
      .fill('Buy cheap lures now at my totally legit site!');
    await page.getByRole('button', { name: /send message/i }).click();

    await expect(page.getByRole('status')).toContainText(/message sent successfully/i);
    expect((await getMockState(request)).calls).toBe(0);
  });

  test('client-side required validation blocks an empty submit', async ({ page, request }) => {
    await page.goto('/contact');
    await page.getByRole('button', { name: /send message/i }).click();

    const validation = await page
      .getByLabel('Full Name')
      .evaluate((el) => (el as HTMLInputElement).validationMessage);
    expect(validation).toMatch(/fill out this field/i);
    expect((await getMockState(request)).calls).toBe(0);
  });

  test('server-side length validation surfaces the error banner', async ({ page }) => {
    await page.goto('/contact');
    await page.getByLabel('Full Name').fill('x'.repeat(101));
    await page.getByLabel('Email Address').fill('valid@indivisiblefairoaks.org');
    await page
      .getByLabel('Message', { exact: true })
      .fill('Long enough to pass the minimum message check.');
    await page.getByRole('button', { name: /send message/i }).click();

    await expect(page.locator('#form-error-message')).toContainText(/name is too long/i);
  });
});
