import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('renders the Persian RTL login foundation without accessibility violations', async ({ page }) => {
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
  await page.goto('./');

  await expect(
    page.getByRole('heading', { name: 'ورود به مدیریت فروشگاه' }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('keeps the authenticated shell, mobile navigation, and global search accessible', async ({ page }) => {
  await page.route('**/api/v1/admin/me', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        userId: 'e395fe88-cccc-4558-9e00-52ef52f7dd49',
        email: 'owner@example.test',
        status: 'active',
        roles: ['owner'],
        permissions: ['admin.access', 'catalog.products.read', 'orders.read', 'staff.read', 'staff.create', 'staff.assign_roles', 'staff.assign_owner', 'staff.suspend', 'roles.read'],
      }),
      contentType: 'application/json',
      status: 200,
    });
  });
  await page.route('**/api/v1/admin/catalog/products**', async (route) => {
    await route.fulfill({ body: JSON.stringify({ items: [], nextCursor: null }), contentType: 'application/json', status: 200 });
  });
  await page.route('**/api/v1/admin/orders**', async (route) => {
    await route.fulfill({ body: JSON.stringify({ items: [], nextCursor: null }), contentType: 'application/json', status: 200 });
  });
  await page.route('**/api/v1/admin/staff**', async (route) => {
    await route.fulfill({ body: JSON.stringify({ data: [{ userId: 'e395fe88-cccc-4558-9e00-52ef52f7dd49', email: 'owner@example.test', status: 'active', roles: ['owner'], permissions: ['admin.access'] }], nextCursor: null }), contentType: 'application/json', status: 200 });
  });
  await page.route('**/api/v1/admin/roles', async (route) => {
    await route.fulfill({ body: JSON.stringify([{ key: 'owner', name: 'Owner', description: 'Full access', permissions: ['admin.access'] }]), contentType: 'application/json', status: 200 });
  });

  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'نمای کلی فروشگاه' })).toBeVisible();

  if (test.info().project.name === 'mobile-chromium') {
    await page.getByRole('button', { name: 'باز کردن منوی مدیریت' }).click();
    await expect(page.getByRole('dialog', { name: 'منوی مدیریت' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'منوی مدیریت' })).toBeHidden();
  }

  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'جست‌وجوی سریع' })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  await page.keyboard.press('Escape');
  await page.goto('./staff');
  await expect(page.getByRole('heading', { name: 'کارکنان و نقش‌ها' })).toBeVisible();
  const staffAccessibility = await new AxeBuilder({ page }).analyze();
  expect(staffAccessibility.violations).toEqual([]);
});
