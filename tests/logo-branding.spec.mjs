import { test, expect } from '@playwright/test';

const pages = [
  'index.html', 'admin.html', 'assistant.html', 'auth.html', 'awareness.html',
  'community.html', 'dashboard.html', 'learning.html', 'leaderboard.html',
  'pricing.html', 'profile.html', 'puzzle.html', 'resources.html',
];

test('every application page loads the official CyberX logo and favicon', async ({ page }) => {
  for (const route of pages) {
    await page.goto(`/${route}`, { waitUntil: 'domcontentloaded' });
    const branding = await page.locator('img[src*="CYBERX-LOGO2.png"]').evaluateAll((images) => ({
      count: images.length,
      allLoaded: images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0),
      allPreserveAspectRatio: images.every((image) => getComputedStyle(image).objectFit === 'cover'),
    }));
    expect(branding.count, `${route} should include the new logo`).toBeGreaterThan(0);
    expect(branding.allLoaded, `${route} logo images should load`).toBe(true);
    expect(branding.allPreserveAspectRatio, `${route} logo rendering should keep the source asset intact`).toBe(true);
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', 'image/CYBERX-LOGO2.png');
  }
});

test('shared navigation logo remains visible at desktop and mobile widths', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['index.html', 'community.html', 'assistant.html']) {
      await page.goto(`/${route}`, { waitUntil: 'domcontentloaded' });
      const logo = page.locator('header img[src="image/CYBERX-LOGO2.png"]').first();
      await expect(logo).toBeVisible();
      const bounds = await logo.boundingBox();
      expect(bounds?.width).toBeGreaterThan(100);
      expect(bounds?.height).toBeGreaterThan(25);
    }
  }
});

test('AI demo conversation keeps the official CyberX assistant mark', async ({ page }) => {
  await page.goto('/assistant.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.assistant-branding img')).toHaveAttribute('src', 'image/CYBERX-LOGO2.png');
  await page.locator('[data-chat-input]').fill('Explain a safe triage workflow');
  await page.locator('[data-chat-form] button[type="submit"]').click();
  await expect(page.locator('[data-chat-history] .assistant-message.assistant').last().locator('.assistant-branding img'))
    .toHaveAttribute('src', 'image/CYBERX-LOGO2.png');
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.locator('[data-chat-history] .assistant-branding img')).toHaveAttribute('src', 'image/CYBERX-LOGO2.png');
});
