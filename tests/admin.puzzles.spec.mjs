import { test, expect, puzzleRecord } from './helpers/admin-fixtures.mjs';

async function openSection(page, name) {
  await page.locator('.sidebar-item').filter({ hasText: name }).click();
}

async function fillPuzzleForm(page, { title = 'Synthetic Created Puzzle', desc = 'Synthetic narrative', url = '' } = {}) {
  await page.locator('#puz-title').fill(title);
  await page.locator('#puz-desc').fill(desc);
  await page.locator('#puz-flag').fill('SYNTHETIC_CREATED_VALUE');
  await page.locator('#puz-url').fill(url);
}

test('full puzzle cards render synthetic text and safe approved route links', async ({ adminSessions }) => {
  const session = await adminSessions();
  const page = await session.authenticate();
  await openSection(page, 'PUZZLES');

  await expect(page.locator('#puzzles-list .puzzle-card')).toHaveCount(2);
  await expect(page.locator('#puzzles-list')).toContainText('Synthetic Puzzle Alpha');
  await expect(page.locator('#puzzles-list .pc-desc').first()).toContainText('Synthetic puzzle narrative');
  const routeLink = page.locator('#puzzles-list .puzzle-card').filter({ hasText: 'Synthetic Puzzle Beta' }).getByRole('link');
  await expect(routeLink).toHaveAttribute('target', '_blank');
  await expect(routeLink).toHaveAttribute('rel', 'noopener noreferrer');
  const canonicalPath = await routeLink.getAttribute('href');
  expect(new URL(canonicalPath).pathname.endsWith('/puzzle.html')).toBe(true);
});

test('puzzle form accepts an empty optional URL and saves hints', async ({ adminSessions }) => {
  const session = await adminSessions({ puzzles: [] });
  const page = await session.authenticate();
  await openSection(page, 'ADD PUZZLE');

  await fillPuzzleForm(page);
  await page.getByRole('button', { name: /ADD HINT/i }).click();
  await page.locator('.hint-input').first().fill('Synthetic first hint — 東京');
  await page.getByRole('button', { name: /ADD HINT/i }).click();
  await page.locator('.hint-input').nth(1).fill('Synthetic removable hint');
  await expect(page.locator('.hint-row')).toHaveCount(2);
  await page.locator('.hint-remove').nth(1).click();
  await expect(page.locator('.hint-row')).toHaveCount(1);

  await page.getByRole('button', { name: /SAVE PUZZLE/i }).click();
  await expect(page.locator('#stat-total-puzzle')).toHaveText('1');
  await expect(page.locator('#puz-title')).toHaveValue('');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cyberx_admin_puzzles_v1')));
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({
    title: 'Synthetic Created Puzzle',
    url: '',
    hints: ['Synthetic first hint — 東京'],
  });
});

test('puzzle route validator accepts exactly the approved relative routes', async ({ adminSessions }) => {
  const session = await adminSessions();
  const page = await session.authenticate();
  const mismatches = await page.evaluate(() => {
    const cases = [
      ['puzzle-route', 'puzzle.html', true],
      ['dot-puzzle-route', './puzzle.html', true],
      ['other-page', 'index.html', false],
      ['root-path', '/puzzle.html', false],
      ['traversal', '../puzzle.html', false],
      ['external-https', 'https://example.com/puzzle.html', false],
      ['http-url', 'http://example.com/puzzle.html', false],
      ['protocol-relative', '//example.com/puzzle.html', false],
      ['javascript-url', 'javascript:alert(1)', false],
    ];
    return cases
      .filter(([name, value, expected]) => Boolean(validateAdminUrl(value, 'puzzle')) !== expected)
      .map(([name]) => name);
  });
  expect(mismatches).toEqual([]);
});

test('puzzle form saves both approved routes and preserves their submitted strings', async ({ adminSessions }) => {
  const session = await adminSessions({ puzzles: [] });
  const page = await session.authenticate();
  await openSection(page, 'ADD PUZZLE');

  for (const [index, route] of ['puzzle.html', './puzzle.html'].entries()) {
    await fillPuzzleForm(page, { title: 'Synthetic Route Puzzle ' + index, url: route });
    await page.getByRole('button', { name: /SAVE PUZZLE/i }).click();
  }

  const storedUrls = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('cyberx_admin_puzzles_v1')).map(record => record.url)
  );
  expect(storedUrls.map(url => new URL(url).pathname)).toEqual(['/puzzle.html', '/puzzle.html']);
});

test('external puzzle URLs remain unavailable and stored text remains unchanged', async ({ adminSessions }) => {
  const legacy = puzzleRecord({
    id: 'pw-puzzle-external-legacy',
    title: 'Synthetic External Puzzle Link',
    url: 'https://example.com/legacy-puzzle',
  });
  const raw = JSON.stringify([legacy]);
  const session = await adminSessions({ puzzles: [legacy] });
  const page = await session.authenticate();
  await openSection(page, 'PUZZLES');

  const card = page.locator('#puzzles-list .puzzle-card');
  await expect(card).toContainText('Synthetic External Puzzle Link');
  await expect(card.locator('a[href]')).toHaveCount(0);
  await expect(card.locator('.link-unavailable')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('cyberx_admin_puzzles_v1'))).toBe(raw);
});

test('invalid puzzle difficulty records are skipped without crashing', async ({ adminSessions }) => {
  const puzzles = [
    puzzleRecord({ id: 'pw-puzzle-valid-difficulty' }),
    puzzleRecord({ id: 'pw-puzzle-bad-difficulty', title: 'Invalid difficulty synthetic', difficulty: 'UNLISTED' }),
  ];
  const raw = JSON.stringify(puzzles);
  const session = await adminSessions({ puzzles });
  const page = await session.authenticate();

  await expect(page.locator('#stat-total-puzzle')).toHaveText('1');
  await expect(page.locator('#dashboard-puzzles .puzzle-card')).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem('cyberx_admin_puzzles_v1'))).toBe(raw);
});

test('puzzle deletion requires confirmation and updates counts', async ({ adminSessions }) => {
  const session = await adminSessions();
  const page = await session.authenticate();
  await openSection(page, 'PUZZLES');

  const card = page.locator('#puzzles-list .puzzle-card').filter({ hasText: 'Synthetic Puzzle Alpha' });
  await card.getByRole('button', { name: /DELETE/i }).click();
  await expect(page.locator('#delete-modal')).toHaveClass(/open/);
  await expect(page.locator('#delete-target-name')).toHaveText('Synthetic Puzzle Alpha');
  await page.getByRole('button', { name: /^CANCEL$/i }).click();
  await expect(page.locator('#puzzles-list .puzzle-card')).toHaveCount(2);

  await page.locator('#puzzles-list .puzzle-card').filter({ hasText: 'Synthetic Puzzle Alpha' }).getByRole('button', { name: /DELETE/i }).click();
  await page.locator('#confirm-delete-btn').click();
  await expect(page.locator('#puzzles-list .puzzle-card')).toHaveCount(1);
  await expect(page.locator('#stat-total-puzzle')).toHaveText('1');
});
test('puzzle creation rejects external URLs without writing them', async ({ adminSessions }) => {
  const session = await adminSessions({ puzzles: [] });
  const page = await session.authenticate();
  await openSection(page, 'ADD PUZZLE');
  await fillPuzzleForm(page, { url: 'https://example.com/not-an-approved-puzzle-route' });
  await page.getByRole('button', { name: /SAVE PUZZLE/i }).click();

  await expect(page.locator('#stat-total-puzzle')).toHaveText('0');
  await expect(page.locator('#toast-container')).toContainText(/approved puzzle route/i);
  const emptyStorage = await page.evaluate(() => localStorage.getItem('cyberx_admin_puzzles_v1') === '[]');
  expect(emptyStorage).toBe(true);
});
