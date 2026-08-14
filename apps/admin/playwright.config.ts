import { defineConfig, devices } from '@playwright/test';

const localBrowser = process.env.CI ? {} : { channel: 'chrome' as const };

export default defineConfig({
  testDir: './test/browser',
  outputDir: './test-results',
  snapshotDir: './test/browser/__screenshots__',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  webServer: {
    command: 'pnpm dev --host 127.0.0.1',
    url: 'http://127.0.0.1:5173/admin/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:5173/admin/',
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], ...localBrowser },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'], ...localBrowser },
    },
  ],
});
