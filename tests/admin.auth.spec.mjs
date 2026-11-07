import { test, expect } from './helpers/admin-fixtures.mjs';

test('authentication gate covers the dashboard before login', async ({ adminSessions }) => {
  const session = await adminSessions();
  await session.open();

  await expect(session.page.locator('#password-gate')).toBeVisible();
  const gateInterceptsDashboard = await session.page.evaluate(() => {
    const gate = document.querySelector('#password-gate');
    const point = document.elementFromPoint(Math.floor(innerWidth / 2), Math.floor(innerHeight / 2));
    return Boolean(gate && point && gate.contains(point));
  });
  expect(gateInterceptsDashboard).toBe(true);
});

test('invalid password is rejected by the normal login form', async ({ adminSessions }) => {
  const session = await adminSessions();
  await session.open();
  await session.login('invalid-' + session.password);

  await expect(session.page.locator('#password-gate')).toBeVisible();
  await expect(session.page.locator('#gate-err')).toContainText(/incorrect password/i);
});

test('temporary isolated password authenticates through the UI', async ({ adminSessions }) => {
  const session = await adminSessions();
  await session.authenticate();

  await expect(session.page.locator('#stat-total-media')).toHaveText(String(3));
  await expect(session.page.locator('#stat-total-puzzle')).toHaveText(String(2));
});

test('reload returns to the authentication gate', async ({ adminSessions }) => {
  const session = await adminSessions();
  await session.authenticate();
  await session.page.reload();

  await expect(session.page.locator('#password-gate')).toBeVisible();
  const gateVisible = await session.page.locator('#password-gate').evaluate(el => getComputedStyle(el).display !== 'none');
  expect(gateVisible).toBe(true);
});

test('separate contexts have independent password and storage state', async ({ adminSessions }) => {
  const first = await adminSessions();
  const second = await adminSessions();
  await first.open();
  await second.open();

  await second.login(first.password);
  await expect(second.page.locator('#gate-err')).toContainText(/incorrect password/i);
  await expect(second.page.locator('#password-gate')).toBeVisible();

  await first.login();
  await expect(first.page.locator('#page-dashboard')).toBeVisible();
  await second.login();
  await expect(second.page.locator('#page-dashboard')).toBeVisible();

  const storageIsIndependent = await first.page.evaluate(() => {
    localStorage.setItem('pw-isolation-sentinel', 'first-context-only');
    return true;
  });
  const secondHasNoSentinel = await second.page.evaluate(() => localStorage.getItem('pw-isolation-sentinel') === null);
  expect(storageIsIndependent && secondHasNoSentinel).toBe(true);
});
