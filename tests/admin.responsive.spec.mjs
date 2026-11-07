import { test, expect } from './helpers/admin-fixtures.mjs';

const viewports = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'tablet', viewport: { width: 768, height: 1024 }, mobile: false },
  { name: 'mobile', viewport: { width: 390, height: 844 }, mobile: true },
  { name: 'small mobile', viewport: { width: 320, height: 740 }, mobile: true },
];
const sections = ['dashboard', 'media', 'add-media', 'puzzles', 'add-puzzle', 'settings', 'export'];

for (const size of viewports) {
  test(`${size.name}: every Admin section, responsive controls and content fit`, async ({ adminSessions }) => {
    const session = await adminSessions({ viewport: size.viewport });
    const page = session.page;
    await session.open();
    await expect(page.locator('#password-gate')).toBeVisible();
    const gate = await page.locator('#password-gate .gate-box').boundingBox();
    expect(gate).not.toBeNull();
    expect(gate.x).toBeGreaterThanOrEqual(0);
    expect(gate.x + gate.width).toBeLessThanOrEqual(size.viewport.width + 1);
    await session.login();
    await expect(page.locator('#password-gate')).toBeHidden();
    await expect(page.locator('.topbar')).toBeVisible();

    const menuToggle = page.locator('#mobile-menu-toggle');
    if (size.mobile) {
      await expect(menuToggle).toBeVisible();
      await expect(page.locator('.sidebar')).toBeHidden();
      await menuToggle.click();
      await expect(page.locator('#mobile-nav')).toBeVisible();
      await expect(menuToggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('#mobile-nav .mobile-nav-item')).toHaveCount(7);
      await page.keyboard.press('Escape');
      await expect(page.locator('#mobile-nav')).toBeHidden();
      await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');
      await menuToggle.click();
      await page.locator('#mobile-nav-backdrop').click({ position: { x: 2, y: 80 } });
      await expect(page.locator('#mobile-nav')).toBeHidden();
    } else {
      await expect(menuToggle).toBeHidden();
      await expect(page.locator('.sidebar')).toBeVisible();
    }

    for (const id of sections) {
      if (size.mobile) {
        await menuToggle.click();
        const navItem = page.locator(`#mobile-nav .mobile-nav-item[data-page="${id}"]`);
        await expect(navItem).toBeVisible();
        await navItem.click();
        await expect(page.locator('#mobile-nav')).toBeHidden();
        await expect(navItem).toHaveAttribute('aria-current', 'page');
      } else {
        await page.locator(`.sidebar-item[data-page="${id}"]`).click();
      }
      await expect(page.locator(`#page-${id}`)).toBeVisible();
      await expect(page.locator(`#page-${id} .page-title`)).toBeVisible();

      if (id === 'dashboard') {
        await expect(page.locator('#stat-total-media')).toHaveText('3');
        await expect(page.locator('#recent-media-tbody tr')).toHaveCount(3);
        await expect(page.locator('#dashboard-puzzles .puzzle-card')).toHaveCount(2);
      }
      if (id === 'media') {
        await expect(page.locator('#media-lib-tbody tr')).toHaveCount(3);
        await expect(page.locator('#filter-module')).toBeVisible();
        await expect(page.locator('#filter-type')).toBeVisible();
      }
      if (id === 'add-media') {
        for (const selector of ['#media-title', '#media-url', '#media-meta']) {
          const control = page.locator(selector);
          await expect(control).toBeVisible();
          const rect = await control.boundingBox();
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.width).toBeLessThanOrEqual(size.viewport.width + 1);
        }
        await page.locator('#media-title').fill('Synthetic mobile preview');
        await page.locator('#media-url').fill('https://example.com/synthetic-preview');
        await expect(page.locator('#media-preview-block')).toBeVisible();
      }
      if (id === 'puzzles') {
        await expect(page.locator('#puzzles-list .puzzle-card')).toHaveCount(2);
        const card = await page.locator('#puzzles-list .puzzle-card').first().boundingBox();
        expect(card.x + card.width).toBeLessThanOrEqual(size.viewport.width + 1);
      }
      if (id === 'add-puzzle') {
        await expect(page.locator('#puz-title')).toBeVisible();
        await expect(page.locator('#puz-url')).not.toHaveAttribute('required', '');
        const before = await page.locator('#hints-container .hint-row').count();
        await page.getByRole('button', { name: /add hint/i }).click();
        await expect(page.locator('#hints-container .hint-row')).toHaveCount(before + 1);
        const hint = await page.locator('#hints-container input').last().boundingBox();
        expect(hint.x + hint.width).toBeLessThanOrEqual(size.viewport.width + 1);
      }
      if (id === 'settings') {
        await expect(page.locator('#pwd-current')).toBeVisible();
        await expect(page.locator('#pwd-new')).toBeVisible();
      }
      if (id === 'export') {
        await page.getByRole('button', { name: 'EXPORT ALL' }).click();
        await expect(page.locator('#export-output')).not.toBeEmpty();
      }

      const main = await page.locator('.main').boundingBox();
      expect(main.x).toBeGreaterThanOrEqual(0);
      expect(main.x + main.width).toBeLessThanOrEqual(size.viewport.width + 1);
      const docWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(docWidth, `${size.name} document width on ${id}`).toBeLessThanOrEqual(size.viewport.width + 1);
    }

    await page.locator('.sidebar-item[data-page="dashboard"]').count().then(async count => {
      if (!size.mobile && count) await page.locator('.sidebar-item[data-page="dashboard"]').click();
    });
    if (size.mobile) {
      await menuToggle.click();
      await page.locator('#mobile-nav .mobile-nav-item[data-page="dashboard"]').click();
    }
    await page.locator('#recent-media-tbody tr').first().getByRole('button').click();
    await expect(page.locator('#delete-modal')).toHaveClass(/open/);
    const modal = await page.locator('#delete-modal .modal').boundingBox();
    expect(modal.x).toBeGreaterThanOrEqual(0);
    expect(modal.y).toBeGreaterThanOrEqual(0);
    expect(modal.x + modal.width).toBeLessThanOrEqual(size.viewport.width + 1);
    expect(modal.y + modal.height).toBeLessThanOrEqual(size.viewport.height + 1);
    await page.getByRole('button', { name: /^CANCEL$/i }).click();
    await expect(page.locator('#delete-modal')).not.toHaveClass(/open/);
    const finalWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(finalWidth, `${size.name} final document width`).toBeLessThanOrEqual(size.viewport.width + 1);
  });
}