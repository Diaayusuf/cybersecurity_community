import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';

const localOrigin = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4174';

const syntheticMedia = [{
  id: 'pw-media-smoke-001',
  type: 'pdf',
  module: 'pen-testing',
  title: 'Synthetic Playwright Media',
  desc: 'Synthetic smoke-test record',
  url: 'https://example.com/cyberx-playwright-smoke.pdf',
  size: '1 MB',
  created: '2099-01-01T00:00:00.000Z',
}];

const syntheticPuzzles = [{
  id: 'pw-puzzle-smoke-001',
  title: 'Synthetic Playwright Puzzle',
  desc: 'Synthetic smoke-test record',
  flag: 'SYNTHETIC_ONLY_FLAG',
  difficulty: 'MEDIUM',
  module: '',
  hints: [],
  layers: '',
  url: '',
  created: '2099-01-01T00:00:00.000Z',
}];

test('Admin authenticates through the UI and renders the dashboard', async ({ browser }) => {
  const testPassword = randomBytes(32).toString('base64url');
  const context = await browser.newContext();
  const pageErrors = [];

  await context.route('**/*', async route => {
    const requestURL = new URL(route.request().url());
    if (requestURL.origin === localOrigin) await route.continue();
    else await route.abort();
  });

  await context.addInitScript(
    ({ suppliedPassword, media, puzzles, localOrigin }) => {
      if (location.origin !== localOrigin) return;
      localStorage.setItem('cyberx_admin_pwd_v1', suppliedPassword);
      localStorage.setItem('cyberx_admin_media_v1', JSON.stringify(media));
      localStorage.setItem('cyberx_admin_puzzles_v1', JSON.stringify(puzzles));
    },
    {
      suppliedPassword: testPassword,
      media: syntheticMedia,
      puzzles: syntheticPuzzles,
      localOrigin,
    },
  );

  try {
    const page = await context.newPage();
    page.on('pageerror', () => pageErrors.push(true));

    await page.goto(localOrigin + '/admin.html');
    await expect(page.locator('#password-gate')).toBeVisible();
    await page.locator('#gate-input').fill(testPassword);
    await page.getByRole('button', { name: /authenticate/i }).click();

    await expect(page.locator('#password-gate')).toBeHidden();
    await expect(page.locator('#page-dashboard')).toBeVisible();
    await expect(page.locator('#stat-total-media')).toHaveText('1');
    await expect(page.locator('#stat-total-puzzle')).toHaveText('1');
    await expect(page.locator('#recent-media-tbody tr')).toHaveCount(1);
    await expect(page.locator('#dashboard-puzzles > *')).toHaveCount(1);
    expect(pageErrors).toHaveLength(0);
  } finally {
    await context.close();
  }
});
