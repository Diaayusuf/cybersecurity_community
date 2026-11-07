import { test, expect } from './helpers/admin-fixtures.mjs';

async function openSettings(page) {
  await page.locator('.sidebar-item').filter({ hasText: 'SETTINGS' }).click();
}

async function counts(page) {
  return page.evaluate(() => ({
    media: JSON.parse(localStorage.getItem('cyberx_admin_media_v1') || '[]').length,
    puzzles: JSON.parse(localStorage.getItem('cyberx_admin_puzzles_v1') || '[]').length,
  }));
}

test('bulk media and puzzle deletion require confirmation and preserve canceled data', async ({ adminSessions }) => {
  const session = await adminSessions();
  const page = await session.authenticate();
  await openSettings(page);

  await page.getByRole('button', { name: /DELETE ALL MEDIA/i }).click();
  await expect(page.locator('#delete-modal')).toHaveClass(/open/);
  await expect(page.locator('#delete-target-name')).toHaveText('ALL MEDIA');
  await page.getByRole('button', { name: /^CANCEL$/i }).click();
  expect(await counts(page)).toEqual({ media: 3, puzzles: 2 });

  await page.getByRole('button', { name: /DELETE ALL MEDIA/i }).click();
  await page.locator('#confirm-delete-btn').click();
  expect(await counts(page)).toEqual({ media: 0, puzzles: 2 });

  await page.getByRole('button', { name: /DELETE ALL PUZZLES/i }).click();
  await expect(page.locator('#delete-target-name')).toHaveText('ALL PUZZLES');
  await page.getByRole('button', { name: /^CANCEL$/i }).click();
  expect(await counts(page)).toEqual({ media: 0, puzzles: 2 });

  await page.getByRole('button', { name: /DELETE ALL PUZZLES/i }).click();
  await page.locator('#confirm-delete-btn').click();
  expect(await counts(page)).toEqual({ media: 0, puzzles: 0 });
});

test('wipe-all confirmation affects only the isolated synthetic collections', async ({ adminSessions }) => {
  const session = await adminSessions();
  const page = await session.authenticate();
  await openSettings(page);

  await page.getByRole('button', { name: /WIPE ALL DATA/i }).click();
  await expect(page.locator('#delete-target-name')).toHaveText('ALL DATA');
  expect(await counts(page)).toEqual({ media: 3, puzzles: 2 });
  await page.locator('#confirm-delete-btn').click();
  await expect(page.locator('#stat-total-media')).toHaveText('0');
  await expect(page.locator('#stat-total-puzzle')).toHaveText('0');
  expect(await counts(page)).toEqual({ media: 0, puzzles: 0 });
});
