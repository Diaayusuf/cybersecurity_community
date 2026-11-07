import { test, expect, mediaRecord, puzzleRecord, BASE_URL } from './helpers/admin-fixtures.mjs';

test('hostile stored fields render literally without creating executable DOM', async ({ adminSessions }) => {
  const mediaPayload = '<img src=x onerror="window.__xssExecuted=true"><script>window.__xssExecuted=true</script> " \' \u0060 & 東京';
  const puzzlePayload = '<svg onload="window.__xssExecuted=true"><iframe srcdoc="<script>window.__xssExecuted=true</script>"></iframe></svg>';
  const media = [mediaRecord({
    id: 'pw-xss-media',
    title: mediaPayload,
    desc: puzzlePayload + '\nSecond line',
    url: 'javascript:window.__xssExecuted=true',
  })];
  const puzzles = [puzzleRecord({
    id: 'pw-xss-puzzle',
    title: puzzlePayload,
    desc: mediaPayload + '\nUnicode — café',
    url: 'data:text/html,synthetic',
    hints: ['<img onerror="window.__xssExecuted=true">'],
  })];
  const session = await adminSessions({ media, puzzles });
  const page = await session.authenticate();

  await expect(page.locator('#media-lib-tbody .td-title')).toHaveText(mediaPayload);
  await expect(page.locator('#media-lib-tbody img, #media-lib-tbody svg, #media-lib-tbody iframe')).toHaveCount(0);
  await expect(page.locator('#puzzles-list .pc-title')).toHaveText(puzzlePayload);
  await expect(page.locator('#puzzles-list .pc-desc')).toHaveText(mediaPayload + '\nUnicode — café');
  await expect(page.locator('#puzzles-list .puzzle-card img, #puzzles-list .puzzle-card svg, #puzzles-list .puzzle-card iframe')).toHaveCount(0);
  await expect(page.locator('#media-lib-tbody a[href^="javascript:"], #puzzles-list a[href^="data:"]')).toHaveCount(0);

  const safeDOM = await page.evaluate(() => ({
    executed: window.__xssExecuted,
    inlineHandlers: [...document.querySelectorAll('#media-lib-tbody *, #puzzles-list *')]
      .some(element => [...element.attributes].some(attribute => /^on/i.test(attribute.name))),
  }));
  expect(safeDOM).toEqual({ executed: false, inlineHandlers: false });
});

test('hostile form text remains text in the live media preview', async ({ adminSessions }) => {
  const session = await adminSessions();
  const page = await session.authenticate();
  await page.locator('.sidebar-item').filter({ hasText: 'ADD PDF / VIDEO' }).click();

  const payload = '<svg onload="window.__xssExecuted=true">"quoted" & unicode λ</svg>';
  await page.locator('#media-title').fill(payload);
  await expect(page.locator('#media-preview-body')).toContainText(payload);
  await expect(page.locator('#media-preview-body svg')).toHaveCount(0);
  expect(await page.evaluate(() => window.__xssExecuted)).toBe(false);
});

test('oversized but supported text renders without a crash', async ({ adminSessions }) => {
  const longTitle = 'L'.repeat(900);
  const longDescription = 'D'.repeat(19000);
  const session = await adminSessions({
    media: [mediaRecord({ id: 'pw-long-media', title: longTitle, desc: longDescription })],
    puzzles: [puzzleRecord({ id: 'pw-long-puzzle', title: 'Long synthetic puzzle', desc: longDescription })],
  });
  const page = await session.authenticate();

  expect(await page.locator('#media-lib-tbody .td-title').textContent()).toHaveLength(900);
  expect(await page.locator('#puzzles-list .pc-desc').textContent()).toHaveLength(123);
  await expect(page.locator('#stat-total-media')).toHaveText('1');
  await expect(page.locator('#stat-total-puzzle')).toHaveText('1');
});

test('malformed and wrong-root storage is preserved and writes are blocked', async ({ adminSessions }) => {
  const malformedMedia = '{"broken":';
  const wrongRootPuzzles = JSON.stringify({ records: [puzzleRecord()] });
  const session = await adminSessions({
    mediaRaw: malformedMedia,
    puzzlesRaw: wrongRootPuzzles,
  });
  const page = await session.authenticate();

  await expect(page.locator('#stat-total-media')).toHaveText('0');
  await expect(page.locator('#stat-total-puzzle')).toHaveText('0');
  await page.locator('.sidebar-item').filter({ hasText: 'ADD PDF / VIDEO' }).click();
  await page.locator('#media-module').selectOption('pen-testing');
  await page.locator('#media-title').fill('Synthetic blocked write');
  await page.locator('#media-url').fill('https://example.com/synthetic');
  await page.getByRole('button', { name: /SAVE MEDIA/i }).click();
  await expect(page.locator('#toast-container')).toContainText(/needs recovery/i);

  const unchanged = await page.evaluate(({ malformedMedia, wrongRootPuzzles }) =>
    localStorage.getItem('cyberx_admin_media_v1') === malformedMedia &&
    localStorage.getItem('cyberx_admin_puzzles_v1') === wrongRootPuzzles,
    { malformedMedia, wrongRootPuzzles },
  );
  expect(unchanged).toBe(true);
});

test('null, primitive, missing-field, duplicate-ID and oversized records do not corrupt valid entries', async ({ adminSessions }) => {
  const media = [
    mediaRecord({ id: 'pw-storage-valid' }),
    null,
    'primitive',
    42,
    { id: 'pw-missing-title', type: 'pdf', module: 'soc' },
    mediaRecord({ id: 'pw-too-long-title', title: 'T'.repeat(1001) }),
    mediaRecord({ id: 'pw-storage-valid', title: 'Duplicate synthetic ID' }),
  ];
  const puzzles = [
    puzzleRecord({ id: 'pw-storage-valid-puzzle' }),
    null,
    'primitive',
    { id: 'pw-missing-fields', title: 'Missing puzzle fields' },
    puzzleRecord({ id: 'pw-bad-hints', hints: Array(101).fill('synthetic') }),
  ];
  const mediaRaw = JSON.stringify(media);
  const puzzlesRaw = JSON.stringify(puzzles);
  const session = await adminSessions({ mediaRaw, puzzlesRaw });
  const page = await session.authenticate();

  await expect(page.locator('#stat-total-media')).toHaveText('1');
  await expect(page.locator('#stat-total-puzzle')).toHaveText('1');
  const unchanged = await page.evaluate(({ mediaRaw, puzzlesRaw }) =>
    localStorage.getItem('cyberx_admin_media_v1') === mediaRaw &&
    localStorage.getItem('cyberx_admin_puzzles_v1') === puzzlesRaw,
    { mediaRaw, puzzlesRaw },
  );
  expect(unchanged).toBe(true);
});

test('record count boundary accepts the limit and preserves an over-limit collection', async ({ adminSessions }) => {
  const atLimit = Array.from({ length: 500 }, (_, index) => mediaRecord({
    id: 'pw-limit-' + index,
    title: 'Synthetic boundary record ' + index,
  }));
  const validSession = await adminSessions({ media: atLimit, puzzles: [] });
  const validPage = await validSession.authenticate();
  await expect(validPage.locator('#stat-total-media')).toHaveText('500');
  await expect(validPage.locator('#media-lib-tbody tr')).toHaveCount(500);

  const overLimit = [...atLimit, mediaRecord({ id: 'pw-limit-over', title: 'Synthetic over-limit record' })];
  const overRaw = JSON.stringify(overLimit);
  const invalidSession = await adminSessions({ mediaRaw: overRaw, puzzles: [] });
  const invalidPage = await invalidSession.authenticate();
  await expect(invalidPage.locator('#stat-total-media')).toHaveText('0');
  const unchanged = await invalidPage.evaluate(raw => localStorage.getItem('cyberx_admin_media_v1') === raw, overRaw);
  expect(unchanged).toBe(true);
});

test('oversized serialized storage is not overwritten', async ({ adminSessions }) => {
  const oversizedRaw = JSON.stringify([mediaRecord({
    id: 'pw-storage-large',
    title: 'Synthetic large record',
    desc: 'D'.repeat(1_000_100),
  })]);
  const session = await adminSessions({ mediaRaw: oversizedRaw, puzzles: [] });
  const page = await session.authenticate();

  await expect(page.locator('#stat-total-media')).toHaveText('0');
  const unchanged = await page.evaluate(raw => localStorage.getItem('cyberx_admin_media_v1') === raw, oversizedRaw);
  expect(unchanged).toBe(true);
});
test('loopback static server serves the Admin page and rejects traversal paths', async ({ adminSessions }) => {
  const session = await adminSessions();
  await session.open();

  const adminResponse = await session.page.request.get(BASE_URL + '/admin.html');
  expect(adminResponse.status()).toBe(200);
  expect(adminResponse.headers()['content-type']).toContain('text/html');

  const traversalResponse = await session.page.request.get(
    BASE_URL + '/%252e%252e/%252e%252e/Windows/win.ini',
  );
  expect(traversalResponse.status()).toBe(404);
});
