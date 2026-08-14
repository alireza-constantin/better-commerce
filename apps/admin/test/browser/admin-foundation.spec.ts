import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/admin/me', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        type: 'urn:better-commerce:problem:http-401',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication is required',
        requestId: 'browser-test-request',
      }),
      contentType: 'application/problem+json',
      status: 401,
    });
  });
});

test('renders the Persian RTL login foundation without accessibility violations', async ({
  page,
}) => {
  await page.goto('./');

  await expect(
    page.getByRole('heading', { name: 'ورود به مدیریت فروشگاه' }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
