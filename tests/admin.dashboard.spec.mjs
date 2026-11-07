import { test, expect, mediaRecord, puzzleRecord } from './helpers/admin-fixtures.mjs';

test('dashboard counters, recent media and compact puzzle cards match synthetic records', async ({ adminSessions }) => {
  const session = await adminSessions();
  const page = await session.authenticate();

  await expect(page.locator('#stat-total-media')).toHaveText('3');
  await expect(page.locator('#stat-total-puzzle')).toHaveText('2');
  await expect(page.locator('#recent-media-tbody tr')).toHaveCount(3);
  await expect(page.locator('#recent-media-tbody tr').first()).toContainText('Synthetic Guide Gamma');
  await expect(page.locator('#dashboard-puzzles .puzzle-card')).toHaveCount(2);
  await expect(page.locator('#dashboard-puzzles')).toContainText('Synthetic Puzzle Alpha');
});

test('dashboard empty states render for empty collections', async ({ adminSessions }) => {
  const session = await adminSessions({ media: [], puzzles: [] });
  const page = await session.authenticate();

  await expect(page.locator('#recent-media-empty')).toBeVisible();
  await expect(page.locator('#dashboard-puzzles-empty')).toBeVisible();
  await expect(page.locator('#stat-total-media')).toHaveText('0');
  await expect(page.locator('#stat-total-puzzle')).toHaveText('0');
});

test('missing optional fields do not break dashboard rendering', async ({ adminSessions }) => {
  const minimalMedia = [{
    id: 'pw-media-minimal',
    type: 'pdf',
    module: 'soc',
    title: 'Synthetic Minimal Media',
  }];
  const minimalPuzzle = [{
    id: 'pw-puzzle-minimal',
    title: 'Synthetic Minimal Puzzle',
    desc: 'Required synthetic narrative',
    flag: 'SYNTHETIC_ONLY',
    difficulty: 'EASY',
  }];
  const session = await adminSessions({ media: minimalMedia, puzzles: minimalPuzzle });
  const page = await session.authenticate();

  await expect(page.locator('#recent-media-tbody tr')).toHaveCount(1);
  await expect(page.locator('#dashboard-puzzles .puzzle-card')).toHaveCount(1);
  await expect(page.locator('#recent-media-tbody')).toContainText('Synthetic Minimal Media');
  await expect(page.locator('#dashboard-puzzles')).toContainText('Synthetic Minimal Puzzle');
});

test('invalid records are skipped without replacing the original storage strings', async ({ adminSessions }) => {
  const mediaRecords = [mediaRecord(), null, { id: 'pw-invalid-media', type: 'other', title: 'Invalid synthetic row' }];
  const puzzleRecords = [puzzleRecord(), null, { id: 'pw-invalid-puzzle', title: 'Invalid synthetic puzzle', desc: 'bad', flag: 'SYNTHETIC_ONLY', difficulty: 'IMPOSSIBLE' }];
  const mediaRaw = JSON.stringify(mediaRecords);
  const puzzlesRaw = JSON.stringify(puzzleRecords);
  const session = await adminSessions({ mediaRaw, puzzlesRaw });
  const page = await session.authenticate();

  await expect(page.locator('#stat-total-media')).toHaveText('1');
  await expect(page.locator('#stat-total-puzzle')).toHaveText('1');
  const stored = await page.evaluate(() => [
    localStorage.getItem('cyberx_admin_media_v1'),
    localStorage.getItem('cyberx_admin_puzzles_v1'),
  ]);
  expect(stored).toEqual([mediaRaw, puzzlesRaw]);
});

test('navigation between sections does not duplicate rendered records', async ({ adminSessions }) => {
  const session = await adminSessions();
  const page = await session.authenticate();

  const mediaNav = page.locator('.sidebar-item').filter({ hasText: 'MEDIA LIBRARY' });
  const puzzleNav = page.locator('.sidebar-item').filter({ hasText: 'PUZZLES' });
  await mediaNav.click();
  await expect(page.locator('#page-media')).toHaveClass(/active-page/);
  await puzzleNav.click();
  await expect(page.locator('#page-puzzles')).toHaveClass(/active-page/);
  await page.locator('.sidebar-item').filter({ hasText: 'DASHBOARD' }).click();
  await expect(page.locator('#page-dashboard')).toHaveClass(/active-page/);
  await mediaNav.click();
  await expect(page.locator('#media-lib-tbody tr')).toHaveCount(3);
  await expect(page.locator('#stat-total-media')).toHaveText('3');
});

