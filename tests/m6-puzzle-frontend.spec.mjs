import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4174';
const pageSource = readFileSync(fileURLToPath(new URL('../puzzle.html', import.meta.url)), 'utf8');
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
const API = /^https:\/\/[^/]+\.supabase\.co\/functions\/v1\/submit-puzzle$/;
const verifiedId = '22222222-2222-4222-8222-222222222222';
const mockSupabase = `
window.__m6Rows = [
 {id:'11111111-1111-4111-8111-111111111111',name:'Legacy Synthetic',domain:'Old test',created_at:'2025-01-01T00:00:00Z',verification_status:'legacy_unverified'},
 {id:'33333333-3333-4333-8333-333333333333',name:'Verified Synthetic',domain:'Test lab',created_at:'2025-01-02T00:00:00Z',verification_status:'server_verified'}
];
window.__m6RealtimeTables = [];
window.supabase = { createClient: () => ({
 from: table => ({ select: fields => ({ order: async () => { window.__m6Read = {table,fields}; return {data:window.__m6Rows,error:null}; } }) }),
 channel: () => { const channel={ on: (_event, filter) => { window.__m6RealtimeTables.push(filter.table); return channel; }, subscribe: callback => { callback('SUBSCRIBED'); return channel; } }; return channel; }
})};`;

async function prepare(page, responseForPost) {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route(CDN, route => route.fulfill({ status: 200, contentType: 'application/javascript', body: mockSupabase }));
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route(API, async route => {
    const headers = {
      'access-control-allow-origin': BASE_URL,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'apikey, content-type, x-client-info',
      'access-control-max-age': '600',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    return responseForPost(route, headers);
  });
  await page.goto('/puzzle.html');
  return pageErrors;
}

test('Hall of Fame reads the explicit compatibility view and labels legacy rows unverified', async ({ page }) => {
  const errors = await prepare(page, async (_route, headers) => _route.fulfill({status: 500, headers}));
  await expect(page.locator('#hof-list')).toContainText('LEGACY · UNVERIFIED');
  await expect(page.locator('#hof-list')).toContainText('SERVER VERIFIED');
  await expect(page.locator('#hof-total')).toContainText('2 OPERATORS RECORDED');
  const readContract = await page.evaluate(() => window.__m6Read);
  expect(readContract.table).toBe('puzzle_leaderboard');
  expect(readContract.fields).toBe('id, name, domain, created_at, verification_status');
  expect(await page.evaluate(() => window.__m6RealtimeTables)).toEqual(['puzzle_players', 'puzzle_verified_solves']);
  expect(pageSource).not.toMatch(/CORRECT_FLAG/);
  expect(pageSource).not.toMatch(/\.from\([^)]*\)\s*\.insert\s*\(/);
  expect(pageSource).not.toMatch(/\.select\(['"]\*['"]\)/);
  expect(errors).toEqual([]);
});

test('only the server response decides wrong versus successful UI state', async ({ page }) => {
  const submissions = [];
  const errors = await prepare(page, async (route, headers) => {
    submissions.push(route.request().postDataJSON());
    if (submissions.length === 1) return route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify({status:'incorrect'})});
    return route.fulfill({status:201,headers,contentType:'application/json',body:JSON.stringify({status:'verified',solve_id:verifiedId,verified_at:'2026-01-03T00:00:00.000Z'})});
  });
  await page.locator('#hof-name').fill('M6 Synthetic');
  await page.locator('#hof-domain').fill('Test Domain');
  await page.locator('#hof-flag').fill('SYNTHETIC-WRONG-ANSWER');
  await page.locator('#hof-submit-btn').click();
  await expect(page.locator('#hof-msg')).toContainText('INCORRECT FLAG');
  await expect(page.locator('#hof-flag')).toHaveClass(/wrong/);
  await expect(page.locator('#hof-name')).toHaveValue('M6 Synthetic');
  expect(submissions[0].challenge_id).toBe('main');
  expect(submissions[0]).not.toHaveProperty('is_correct');
  expect(submissions[0]).not.toHaveProperty('score');

  await page.locator('#hof-flag').fill('SYNTHETIC-TEST-ANSWER');
  await page.locator('#hof-submit-btn').click();
  await expect(page.locator('#hof-msg')).toContainText('ACCESS GRANTED');
  await expect(page.locator('#hof-name')).toHaveValue('');
  await expect(page.locator('#hof-domain')).toHaveValue('');
  await expect(page.locator('#hof-flag')).toHaveValue('');
  await expect(page.locator('#hof-list')).toContainText('M6 Synthetic');
  await expect(page.locator('#hof-list')).toContainText('SERVER VERIFIED');
  expect(submissions).toHaveLength(2);
  expect(submissions[0].idempotency_key).not.toBe(submissions[1].idempotency_key);
  expect(errors).toEqual([]);
});

test('network retries reuse one idempotency key and failure states never show success', async ({ page }) => {
  const submissions = [];
  let attempt = 0;
  const errors = await prepare(page, async (route, headers) => {
    attempt++;
    submissions.push(route.request().postDataJSON());
    if (attempt === 1) return route.abort();
    if (attempt === 2) return route.fulfill({status:429,headers:{...headers,'retry-after':'60'},contentType:'application/json',body:'{"error":"limited"}'});
    if (attempt === 3) return route.fulfill({status:500,headers,contentType:'application/json',body:'{"error":"internal"}'});
    return route.fulfill({status:200,headers,contentType:'application/json',body:'not-json'});
  });
  await page.locator('#hof-name').fill('Retry Synthetic');
  await page.locator('#hof-flag').fill('SYNTHETIC-TEST-ANSWER');
  for (const expected of ['VERIFICATION UNAVAILABLE', 'TOO MANY ATTEMPTS', 'VERIFICATION UNAVAILABLE', 'VERIFICATION UNAVAILABLE']) {
    await page.locator('#hof-submit-btn').click();
    await expect(page.locator('#hof-msg')).toContainText(expected);
    await expect(page.locator('#hof-msg')).not.toContainText('ACCESS GRANTED');
  }
  expect(submissions).toHaveLength(4);
  expect(new Set(submissions.map(item => item.idempotency_key)).size).toBe(1);
  expect(errors).toEqual([]);
});