import { test, expect, mediaRecord, puzzleRecord } from './helpers/admin-fixtures.mjs';

test('all-data export includes synthetic records and unknown fields without mutating storage', async ({ adminSessions }) => {
  const media = [
    mediaRecord({
      id: 'pw-export-media',
      title: 'Synthetic quote " and Unicode café 東京 <script>window.__xssExecuted=true</script>',
      url: 'http://example.com/synthetic-legacy-url',
      extraMediaField: { source: 'synthetic-export-test', preserved: true },
    }),
  ];
  const puzzles = [
    puzzleRecord({
      id: 'pw-export-puzzle',
      title: 'Synthetic puzzle quote " — λ',
      url: 'https://example.com/synthetic-legacy-puzzle',
      extraPuzzleField: 'preserved synthetic metadata',
    }),
  ];
  const mediaRaw = JSON.stringify(media);
  const puzzlesRaw = JSON.stringify(puzzles);
  const session = await adminSessions({ mediaRaw, puzzlesRaw });
  const page = await session.authenticate();
  await page.locator('.sidebar-item').filter({ hasText: 'EXPORT DATA' }).click();

  await page.getByRole('button', { name: /EXPORT ALL/i }).click();
  const summary = await page.evaluate(({ mediaRaw, puzzlesRaw }) => {
    const output = document.querySelector('#export-output');
    const data = JSON.parse(output.textContent);
    return {
      mediaCount: data.media.length,
      puzzleCount: data.puzzles.length,
      mediaUnknownField: data.media[0].extraMediaField?.preserved === true,
      puzzleUnknownField: data.puzzles[0].extraPuzzleField === 'preserved synthetic metadata',
      unicodeSurvived: output.textContent.includes('café 東京') && output.textContent.includes('λ'), quotedTextSurvived: data.media[0].title.includes('"'), xssSentinelUnchanged: window.__xssExecuted === false,
      hostileMarkupRemainsText: data.media[0].title.includes('<script>') && output.querySelectorAll('script').length === 0,
      legacyURLsPreserved:
        data.media[0].url === 'http://example.com/synthetic-legacy-url' &&
        data.puzzles[0].url === 'https://example.com/synthetic-legacy-puzzle',
      storageUnchanged:
        localStorage.getItem('cyberx_admin_media_v1') === mediaRaw &&
        localStorage.getItem('cyberx_admin_puzzles_v1') === puzzlesRaw,
    };
  }, { mediaRaw, puzzlesRaw });

  expect(summary).toEqual({
    mediaCount: 1,
    puzzleCount: 1,
    mediaUnknownField: true,
    puzzleUnknownField: true,
    unicodeSurvived: true,
    quotedTextSurvived: true,
    xssSentinelUnchanged: true,    hostileMarkupRemainsText: true,
    legacyURLsPreserved: true,
    storageUnchanged: true,
  });
});

test('media-only and puzzle-only exports are valid JSON', async ({ adminSessions }) => {
  const session = await adminSessions();
  const page = await session.authenticate();
  await page.locator('.sidebar-item').filter({ hasText: 'EXPORT DATA' }).click();

  await page.getByRole('button', { name: /EXPORT MEDIA JSON/i }).click();
  const mediaSummary = await page.evaluate(() => {
    const data = JSON.parse(document.querySelector('#export-output').textContent);
    return { count: data.media.length, grouped: Object.keys(data.mediaByModule).length > 0 };
  });
  expect(mediaSummary).toEqual({ count: 3, grouped: true });

  await page.getByRole('button', { name: /EXPORT PUZZLES JSON/i }).click();
  const puzzleCount = await page.evaluate(() =>
    JSON.parse(document.querySelector('#export-output').textContent).puzzles.length
  );
  expect(puzzleCount).toBe(2);
});

test('empty export works for empty collections', async ({ adminSessions }) => {
  const session = await adminSessions({ media: [], puzzles: [] });
  const page = await session.authenticate();
  await page.locator('.sidebar-item').filter({ hasText: 'EXPORT DATA' }).click();
  await page.getByRole('button', { name: /EXPORT ALL/i }).click();

  const counts = await page.evaluate(() => {
    const data = JSON.parse(document.querySelector('#export-output').textContent);
    return [data.media.length, data.puzzles.length, Object.keys(data.mediaByModule).length];
  });
  expect(counts).toEqual([0, 0, 0]);
});

