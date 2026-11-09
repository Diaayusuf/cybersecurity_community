import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const shots = fileURLToPath(new URL('../docs/testing/community-m7m8-screenshots/', import.meta.url));
mkdirSync(shots, { recursive: true });

test.beforeEach(async ({ page }) => {
  await page.route('**/assets/js/cyberx-local-config.js', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript', body: 'window.CYBERX_SUPABASE_CONFIG = null;',
  }));
});

test('Community composer and feed stay within the CyberX layout at required widths', async ({ page }) => {
  for (const width of [1920, 1440, 1280, 1024, 768, 390, 375, 320]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    await page.goto('/community.html');
    await expect(page.locator('[data-community-form]')).toBeVisible();
    const geometry = await page.evaluate(() => {
      const form = document.querySelector('[data-community-form]');
      const card = form.closest('.pad-card');
      const controls = [...form.querySelectorAll('input, select, textarea')];
      const boxes = controls.map((control) => {
        const label = form.querySelector(`label[for="${control.id}"]`).getBoundingClientRect();
        const input = control.getBoundingClientRect();
        return { labelBottom: label.bottom, inputTop: input.top, inputWidth: input.width, cardLeft: card.getBoundingClientRect().left, cardRight: card.getBoundingClientRect().right, inputLeft: input.left, inputRight: input.right };
      });
      return { pageWidth: document.documentElement.scrollWidth, viewport: innerWidth, boxes };
    });
    expect(geometry.pageWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(width);
    for (const box of geometry.boxes) {
      expect(box.inputTop, `label should be above input at ${width}px`).toBeGreaterThanOrEqual(box.labelBottom);
      expect(box.inputWidth, `control should fill card at ${width}px`).toBeGreaterThan(0);
      expect(box.inputLeft, `control left edge outside card at ${width}px`).toBeGreaterThanOrEqual(box.cardLeft);
      expect(box.inputRight, `control right edge outside card at ${width}px`).toBeLessThanOrEqual(box.cardRight + 1);
    }
    if (width === 1440) await page.screenshot({ path: `${shots}/1440-community-default.png`, fullPage: true });
    if (width === 1024) await page.screenshot({ path: `${shots}/1024-community-tablet.png`, fullPage: true });
    if (width === 390) await page.screenshot({ path: `${shots}/390-community-mobile.png`, fullPage: true });
    if (width === 320) await page.screenshot({ path: `${shots}/320-community-mobile.png`, fullPage: true });
  }
});

test('Community validates required fields and keeps selected category in a safe local demo post', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/community.html');
  await page.locator('[data-community-form] button[type="submit"]').click();
  await expect(page.locator('[data-community-status]')).toContainText('Review the highlighted fields');
  await expect(page.locator('[data-field-error="title"]')).toContainText('Enter a title.');
  await expect(page.locator('[data-field-error="content"]')).toContainText('Enter post content.');
  await page.screenshot({ path: `${shots}/1440-community-validation.png`, fullPage: true });

  const title = '<img src=x onerror=alert(1)>';
  await page.locator('[name="post-title"]').fill(title);
  await page.locator('[name="post-category"]').selectOption('DFIR');
  await page.locator('[name="post-content"]').fill('Body <script>alert("x")</script>');
  await page.locator('[data-community-form] button[type="submit"]').click();
  const created = page.locator('[data-community-feed] article').first();
  await expect(created.locator('.post-title')).toHaveText(title);
  await expect(created.locator('.community-post-category')).toHaveText('DFIR');
  await expect(created.locator('p')).toHaveText('Body <script>alert("x")</script>');
  await expect(created.locator('img, script')).toHaveCount(0);
  await expect(page.locator('[data-community-status]')).toContainText('not saved to a server');
  await expect(page.locator('[name="post-title"]')).toHaveValue('');
  await page.screenshot({ path: `${shots}/1440-community-success-demo.png`, fullPage: true });
});

test('Community submission announces loading, blocks duplicate submits, and returns to enabled state', async ({ page }) => {
  await page.addInitScript(() => {
    const callbacks = [];
    window.requestAnimationFrame = (callback) => { callbacks.push(callback); return callbacks.length; };
    window.__flushAnimationFrames = () => callbacks.splice(0).forEach((callback) => callback(performance.now()));
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/community.html');
  await page.locator('[name="post-title"]').fill('Concurrent demo submit');
  await page.locator('[name="post-content"]').fill('Only one card should be added.');
  const form = page.locator('[data-community-form]');
  await form.evaluate((node) => node.requestSubmit());
  await expect(page.locator('[data-community-status]')).toContainText('Adding your post');
  await expect(form.locator('button[type="submit"]')).toBeDisabled();
  await page.screenshot({ path: `${shots}/1440-community-submitting.png`, fullPage: true });
  await form.evaluate((node) => node.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await page.evaluate(() => window.__flushAnimationFrames());
  await expect(page.locator('[data-community-feed] .post-title', { hasText: 'Concurrent demo submit' })).toHaveCount(1);
  await expect(form.locator('button[type="submit"]')).toBeEnabled();
});

test('Community feed handles an empty list; comments and votes stay explicitly demo-only', async ({ page }) => {
  await page.goto('/community.html');
  await page.locator('[data-community-feed]').evaluate((feed) => feed.replaceChildren());
  await page.locator('[data-community-form]').dispatchEvent('input');
  await expect(page.locator('[data-community-feed] .community-empty')).toHaveText('No community posts yet.');
  await page.reload();
  const vote = page.locator('[data-vote="up"]').first();
  await vote.click();
  await vote.dispatchEvent('click');
  await expect(page.locator('[data-vote-count]').first()).toHaveText('43');
  await expect(vote).toBeDisabled();
  await expect(page.locator('.toast')).toContainText('not saved');
  await page.locator('[data-demo-action="demo"]').first().click();
  await expect(page.locator('.toast').last()).toContainText('not be saved');
});
