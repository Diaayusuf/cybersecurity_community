import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));

test('awareness uses the shared grouped navbar on desktop and mobile', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/awareness.html');

  const nav = page.locator('.header .nav');
  await expect(nav.locator('.nav-group')).toHaveCount(6);
  const links = await nav.locator('.nav-dropdown a').evaluateAll(anchors =>
    anchors.map(anchor => ({ label: anchor.textContent.trim(), href: anchor.getAttribute('href') })));
  expect(links.length).toBeGreaterThan(0);
  for (const { label, href } of links) {
    const route = href.split('#')[0];
    expect(existsSync(resolve(repo, route)), `${label} route exists`).toBe(true);
    const response = await page.request.get(new URL(route, page.url()).href);
    expect(response.ok(), `${label} route responds`).toBe(true);
  }

  const awarenessGroup = nav.locator('.nav-group').filter({ has: page.getByRole('button', { name: 'Awareness' }) });
  const awarenessButton = awarenessGroup.getByRole('button', { name: 'Awareness' });
  await awarenessButton.hover();
  await expect(awarenessButton).toHaveAttribute('aria-expanded', 'false');
  await awarenessButton.click();
  await expect(awarenessButton).toHaveAttribute('aria-expanded', 'true');
  await expect(awarenessGroup.locator('.nav-dropdown a')).toHaveCount(7);
  await page.keyboard.press('Escape');
  await expect(awarenessButton).toHaveAttribute('aria-expanded', 'false');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  const mobileMenu = page.locator('.header .mobile-menu');
  await expect(mobileMenu).toBeVisible();
  const mobileAwareness = mobileMenu.locator('.mobile-category').filter({ has: page.getByRole('button', { name: 'Awareness' }) });
  await mobileAwareness.getByRole('button', { name: 'Awareness' }).click();
  await expect(mobileAwareness.locator('a')).toHaveCount(7);
  expect(errors).toEqual([]);
});
