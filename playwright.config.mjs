import { defineConfig, devices } from '@playwright/test';

const testPort = 4174;
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${testPort}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  outputDir: './test-results',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    screenshot: 'off',
    video: 'off',
    trace: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: process.platform === 'win32'
      ? `set PORT=${testPort} && set PLAYWRIGHT_BASE_URL=${baseURL} && node scripts/serve-static.mjs`
      : `PORT=${testPort} PLAYWRIGHT_BASE_URL=${baseURL} node scripts/serve-static.mjs`,
    url: baseURL + '/admin.html',
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
