import { test, expect, mediaRecord, STORAGE_KEYS } from './helpers/admin-fixtures.mjs';

async function openSection(page, name) {
  await page.locator('.sidebar-item').filter({ hasText: name }).click();
}

async function fillMediaForm(page, { title = 'Synthetic Created Media', url = 'https://example.com/cyberx-test-resource', module = 'pen-testing', desc = 'Synthetic description', meta = '' } = {}) {
  await page.locator('#media-module').selectOption(module);
  await page.locator('#media-title').fill(title);
  await page.locator('#media-desc').fill(desc);
  await page.locator('#media-url').fill(url);
  await page.locator('#media-meta').fill(meta);
}

test('media table renders validated links and module/type filters', async ({ adminSessions }) => {
  const session = await adminSessions();
  const page = await session.authenticate();
  await openSection(page, 'MEDIA LIBRARY');

  await expect(page.locator('#media-lib-tbody tr')).toHaveCount(3);
  const firstLink = page.locator('#media-lib-tbody tr').first().getByRole('link');
  await expect(firstLink).toHaveAttribute('target', '_blank');
  await expect(firstLink).toHaveAttribute('rel', 'noopener noreferrer');

  await page.locator('#filter-module').selectOption('soc');
  await expect(page.locator('#media-lib-tbody tr')).toHaveCount(1);
  await expect(page.locator('#media-lib-tbody')).toContainText('Synthetic Video Beta');

  await page.locator('#filter-type').selectOption('pdf');
  await expect(page.locator('#media-lib-tbody tr')).toHaveCount(0);
  await expect(page.locator('#media-lib-empty')).toBeVisible();

  await page.locator('#filter-module').selectOption('');
  await page.locator('#filter-type').selectOption('');
  await expect(page.locator('#media-lib-tbody tr')).toHaveCount(3);
});

test('media creation validates required fields, previews, saves and resets the form', async ({ adminSessions }) => {
  const session = await adminSessions();
  const page = await session.authenticate();
  await openSection(page, 'ADD PDF / VIDEO');

  const before = await page.evaluate(() => localStorage.getItem('cyberx_admin_media_v1'));
  await page.getByRole('button', { name: /SAVE MEDIA/i }).click();
  await expect(page.locator('#toast-container')).toContainText(/select a module/i);
  await page.locator('#media-module').selectOption('pen-testing');
  await page.getByRole('button', { name: /SAVE MEDIA/i }).click();
  await expect(page.locator('#toast-container')).toContainText(/title is required/i);
  expect(await page.evaluate(() => localStorage.getItem('cyberx_admin_media_v1'))).toBe(before);

  await fillMediaForm(page, { title: 'Synthetic Created Media', url: '' });
  await page.getByRole('button', { name: /SAVE MEDIA/i }).click();
  await expect(page.locator('#toast-container')).toContainText(/url is required/i);
  expect(await page.evaluate(() => localStorage.getItem('cyberx_admin_media_v1'))).toBe(before);

  await fillMediaForm(page, {
    title: 'Synthetic Created Media',
    url: 'https://example.com/cyberx-test-resource',
    desc: 'Unicode synthetic text — 東京',
    meta: '',
  });
  await expect(page.locator('#media-preview-block')).toBeVisible();
  await expect(page.locator('#media-preview-body')).toContainText('Synthetic Created Media');
  await expect(page.locator('#media-preview-body')).toContainText('Unicode synthetic text — 東京');

  await page.locator('#type-video-btn').click();
  await expect(page.locator('#meta-label')).toHaveText('DURATION');
  await page.getByRole('button', { name: /SAVE MEDIA/i }).click();

  await expect(page.locator('#stat-total-media')).toHaveText('4');
  await expect(page.locator('#media-preview-block')).toBeHidden();
  await expect(page.locator('#media-title')).toHaveValue('');
  await expect(page.locator('#media-url')).toHaveValue('');

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cyberx_admin_media_v1')));
  expect(saved).toHaveLength(4);
  expect(saved[3]).toMatchObject({
    type: 'video',
    title: 'Synthetic Created Media',
    duration: '—',
    url: 'https://example.com/cyberx-test-resource',
  });
  expect(saved[3]).not.toHaveProperty('size');
});

test('media preview updates as text fields change and clear hides it', async ({ adminSessions }) => {
  const session = await adminSessions();
  const page = await session.authenticate();
  await openSection(page, 'ADD PDF / VIDEO');

  await page.locator('#media-title').fill('<b>Synthetic preview</b>');
  await page.locator('#media-desc').fill('Quotes " and apostrophes \u0027 remain text');
  await expect(page.locator('#media-preview-block')).toBeVisible();
  await expect(page.locator('#media-preview-body')).toContainText('<b>Synthetic preview</b>');
  await expect(page.locator('#media-preview-body b')).toHaveCount(0);

  await page.getByRole('button', { name: /^CLEAR$/i }).click();
  await expect(page.locator('#media-preview-block')).toBeHidden();
  await expect(page.locator('#media-title')).toHaveValue('');
});

test('invalid media URL is rejected before storage changes', async ({ adminSessions }) => {
  const session = await adminSessions();
  const page = await session.authenticate();
  await openSection(page, 'ADD PDF / VIDEO');
  const before = await page.evaluate(() => localStorage.getItem('cyberx_admin_media_v1'));

  await fillMediaForm(page, { url: 'http://example.com/not-approved' });
  await page.getByRole('button', { name: /SAVE MEDIA/i }).click();
  await expect(page.locator('#toast-container')).toContainText(/valid https url/i);
  expect(await page.evaluate(() => localStorage.getItem('cyberx_admin_media_v1'))).toBe(before);
});

test('M4 media URL policy accepts safe HTTPS forms and rejects unsafe forms', async ({ adminSessions }) => {
  const session = await adminSessions();
  const page = await session.authenticate();
  const cases = [
    ['https-docs', 'https://example.com/resource', 'media', true],
    ['youtube-watch-query', 'https://www.youtube.com/watch?v=synthetic', 'media', true],
    ['youtube-search-query', 'https://www.youtube.com/results?search_query=synthetic', 'media', true],
    ['idn-host', 'https://例え.テスト/resource', 'media', true],
    ['encoded-query-fragment', 'https://example.com/a%20b?q=x%26y#part', 'media', true],
    ['http', 'http://example.com/resource', 'media', false],
    ['javascript', 'javascript:alert(1)', 'media', false],
    ['data', 'data:text/html,synthetic', 'media', false],
    ['vbscript', 'vbscript:synthetic', 'media', false],
    ['file', 'file:///synthetic', 'media', false],
    ['protocol-relative', '//example.com/resource', 'media', false],
    ['credentials', 'https://synthetic@example.com/resource', 'media', false],
    ['internal-whitespace', 'https://example.com/a b', 'media', false],
    ['control-character', 'https://example.com/a\\npath', 'media', false],
    ['backslash', 'https://example.com\\\\path', 'media', false],
    ['malformed', 'https://[invalid', 'media', false],
    ['relative-media', 'puzzle.html', 'media', false],
  ];
  const mismatches = await page.evaluate(input => {
    const cases = [...input,
      ['leading-trailing-spaces', '  https://example.com/resource  ', 'media', true],
      ['control-newline', 'https://example.com/a' + String.fromCharCode(10) + 'path', 'media', false],
      ['control-tab', 'https://example.com/a' + String.fromCharCode(9) + 'path', 'media', false],
      ['unknown-scheme', 'ftp://example.com/resource', 'media', false],
      ['empty', '', 'media', false],
    ];
    return cases
      .filter(([name, value, kind, expected]) => Boolean(validateAdminUrl(value, kind)) !== expected)
      .map(([name]) => name);
  }, cases);
  expect(mismatches).toEqual([]);
});

test('media and dashboard links block legacy URLs without rewriting storage', async ({ adminSessions }) => {
  const legacyUrl = 'javascript:synthetic-legacy';
  const records = [
    mediaRecord(),
    mediaRecord({ id: 'pw-media-legacy', title: 'Synthetic Legacy URL', url: legacyUrl }),
  ];
  const raw = JSON.stringify(records);
  const session = await adminSessions({ media: records });
  const page = await session.authenticate();

  await expect(page.locator('#recent-media-tbody tr')).toHaveCount(2);
  await openSection(page, 'MEDIA LIBRARY');
  const tableRow = page.locator('#media-lib-tbody tr').filter({ hasText: 'Synthetic Legacy URL' });
  const dashboardRow = page.locator('#recent-media-tbody tr').filter({ hasText: 'Synthetic Legacy URL' });
  await expect(tableRow.locator('a[href]')).toHaveCount(0);
  await expect(tableRow.locator('.link-unavailable')).toHaveCount(1);
  await expect(dashboardRow.locator('a[href]')).toHaveCount(0);
  await expect(dashboardRow.locator('.link-unavailable')).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem('cyberx_admin_media_v1'))).toBe(raw);
});

test('media delete cancellation preserves data and confirmation deletes only the selected record', async ({ adminSessions }) => {
  const session = await adminSessions();
  const page = await session.authenticate();
  await openSection(page, 'MEDIA LIBRARY');

  const row = page.locator('#media-lib-tbody tr').filter({ hasText: 'Synthetic PDF Alpha' });
  await row.getByRole('button', { name: /DEL/i }).click();
  await expect(page.locator('#delete-modal')).toHaveClass(/open/);
  await expect(page.locator('#delete-target-name')).toHaveText('Synthetic PDF Alpha');
  await page.getByRole('button', { name: /^CANCEL$/i }).click();
  await expect(page.locator('#media-lib-tbody tr')).toHaveCount(3);

  await page.locator('#media-lib-tbody tr').filter({ hasText: 'Synthetic PDF Alpha' }).getByRole('button', { name: /DEL/i }).click();
  await page.locator('#confirm-delete-btn').click();
  await expect(page.locator('#media-lib-tbody tr')).toHaveCount(2);
  await expect(page.locator('#media-lib-tbody')).not.toContainText('Synthetic PDF Alpha');

  const ids = await page.evaluate(() => JSON.parse(localStorage.getItem('cyberx_admin_media_v1')).map(item => item.id));
  expect(ids).toEqual(['pw-media-b2', 'pw-media-c3']);
});

test('media reload preserves synthetic data and session returns to gate', async ({ adminSessions }) => {
  const session = await adminSessions();
  const page = await session.authenticate();
  await openSection(page, 'ADD PDF / VIDEO');
  await fillMediaForm(page);
  await page.getByRole('button', { name: /SAVE MEDIA/i }).click();
  await expect(page.locator('#stat-total-media')).toHaveText('4');

  await page.reload();
  await expect(page.locator('#password-gate')).toBeVisible();
  await session.login();
  await expect(page.locator('#stat-total-media')).toHaveText('4');
  const titles = await page.evaluate(() => JSON.parse(localStorage.getItem('cyberx_admin_media_v1')).map(item => item.title));
  expect(titles).toContain('Synthetic Created Media');
});

test('media search and edit are not applicable because the current UI has no search or edit controls', async ({ adminSessions }) => {
  const session = await adminSessions();
  const page = await session.authenticate();
  await openSection(page, 'MEDIA LIBRARY');

  await expect(page.locator('#page-media input[type="search"], #page-media [id*="search"]')).toHaveCount(0);
  await expect(page.locator('#media-lib-tbody tr').first().getByRole('button')).toHaveCount(1);
});



