import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));

test('homepage desktop and mobile menus are generated from the public navigation registry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/index.html');
  const navigation = await page.evaluate(() => {
    const config = window.CYBERX_NAVIGATION;
    const groups = config.categories.map(category => ({
      name: category.name,
      items: category.items.map(item => ({ name: item.name, destination: item.destination, aliases: item.aliases, availability: item.availability, access: item.access })),
    }));
    return {
      groups,
      desktop: [...document.querySelectorAll('.home-nav-desktop [data-navigation-page]')].map(link => ({ name: link.dataset.navigationPage, destination: link.getAttribute('href') })),
      mobile: [...document.querySelectorAll('.home-mobile-nav [data-navigation-page]')].map(link => ({ name: link.dataset.navigationPage, destination: link.getAttribute('href') })),
      triggers: [...document.querySelectorAll('.home-nav-trigger')].map(button => button.textContent),
    };
  });
  expect(navigation.groups.map(group => group.name)).toEqual(['Main', 'Teams', 'Intelligence', 'Platform', 'Community', 'Account']);
  expect(navigation.triggers).toEqual(['TEAMS', 'INTELLIGENCE', 'PLATFORM', 'COMMUNITY', 'ACCOUNT']);
  const expectedLinks = navigation.groups.flatMap(group => group.items.filter(item => item.availability === 'available' && item.access === 'public'));
  for (const menu of [navigation.desktop, navigation.mobile]) {
    expect(menu).toEqual(expectedLinks.map(item => ({ name: item.name, destination: item.destination })));
  }
  for (const width of [1440, 1280, 1024, 961, 960, 901, 900, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    const layout = await page.evaluate(() => {
      const bounds = selector => {
        const element = document.querySelector(selector);
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, display: getComputedStyle(element).display };
      };
      return { nav: bounds('#main-nav'), logo: bounds('#main-nav .logo'), desktop: bounds('.home-nav-desktop'), menu: bounds('#home-mobile-toggle'), terminal: bounds('.terminal-btn') };
    });
    expect(layout.nav.right).toBeLessThanOrEqual(width);
    if (width > 960) {
      expect(layout.desktop.display).not.toBe('none');
      expect(layout.logo.right, `desktop nav overlaps the logo at ${width}px`).toBeLessThanOrEqual(layout.desktop.left);
      expect(layout.desktop.right, `desktop nav overlaps the terminal button at ${width}px`).toBeLessThanOrEqual(layout.terminal.left);
      expect(layout.terminal.right).toBeLessThanOrEqual(width);
    } else {
      expect(layout.desktop.display).toBe('none');
      expect(layout.menu.display).not.toBe('none');
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#home-mobile-toggle').click();
  const intelligenceToggle = page.locator('.home-mobile-group-toggle', { hasText: 'INTELLIGENCE' });
  await intelligenceToggle.click();
  const panelId = await intelligenceToggle.getAttribute('aria-controls');
  const intelligencePanel = page.locator(`#${panelId}`);
  await expect(intelligencePanel).toBeVisible();
  await expect(intelligencePanel.locator('[data-navigation-page]')).toHaveCount(4);
  expect(expectedLinks.some(item => item.name.toLowerCase() === 'admin')).toBe(false);

  for (const item of expectedLinks) {
    if (item.destination.startsWith('#')) {
      await expect(page.locator(item.destination)).toHaveCount(1);
    } else {
      const route = item.destination.split('#')[0];
      expect(existsSync(resolve(repo, route)), `${item.name} route should exist: ${route}`).toBe(true);
      const response = await page.request.get(new URL(route, page.url()).href);
      expect(response.ok(), `${item.name} route should return successfully: ${route}`).toBe(true);
    }
  }
});

test('terminal help, grouped pages, aliases, invalid destinations, and legacy commands remain available', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/index.html');
  await page.locator('.terminal-btn').click();
  await expect(page.locator('#terminal-overlay')).toHaveClass(/open/);
  const input = page.locator('#t-input');
  const run = async command => { await input.fill(command); await input.press('Enter'); };

  await run('help');
  await expect(page.locator('#terminal-body')).toContainText('navigate <page>');
  await run('pages');
  const output = page.locator('#terminal-body');
  for (const category of ['Main:', 'Teams:', 'Intelligence:', 'Platform:', 'Community:', 'Account:']) await expect(output).toContainText(category);
  for (const name of ['Home', 'Red Team', 'Blue Team', 'Secret', 'Awareness', 'Articles', 'Resources', 'Learning', 'Puzzle Arena', 'Experience', 'Dashboard', 'Leaderboard', 'Community', 'AI Assistant', 'Donate', 'Sign In', 'Profile', 'Pricing']) await expect(output).toContainText(name);
  await run('menu');
  await expect(output).toContainText('CyberX navigation menu:');

  const aliases = await page.evaluate(() => {
    const entries = window.CYBERX_NAVIGATION.categories.flatMap(category => category.items);
    return entries.flatMap(item => [item.name, ...item.aliases].map(alias => ({ alias, destination: item.destination, resolved: resolveNavigationPage(alias)?.destination })));
  });
  for (const alias of aliases) expect(alias.resolved, `alias should resolve: ${alias.alias}`).toBe(alias.destination);

  await run('navigate communit');
  await expect(output).toContainText('Did you mean: Community?');
  await expect(page.locator('#terminal-overlay')).toHaveClass(/open/);
  await run('navigate no-such-page');
  await expect(output).toContainText('Type pages to see the available page names.');

  await run('pwd');
  await expect(output).toContainText('/cyberx');
  await run('ls');
  await expect(output).toContainText('red-team/');
  await run('cd red-team');
  await run('pwd');
  await expect(output).toContainText('/cyberx/red-team');
  await run('cd ..');
  await run('cat README.txt');
  await expect(output).toContainText('Welcome to CYBERX.');
  await run('whoami');
  await expect(output).toContainText('cyberx@root');
  await run('history');
  await expect(output).toContainText('ls');
  await run('--modules');
  await expect(output).toContainText('Penetration Testing');
  await run('--status');
  await expect(output).toContainText('Firewall');
  await run('--hint');
  await expect(output).toContainText('HINT SYSTEM:');
  await run('--about');
  await expect(output).toContainText('CYBERX v1.0.0');
  await run('--secret');
  await expect(output).toContainText('YOU FOUND A HIDDEN COMMAND.');
  await run('not-a-command');
  await expect(output).toContainText('command not found: not-a-command');
  await run('echo terminal-ok');
  await expect(output).toContainText('terminal-ok');
  await run('find awareness');
  await expect(output).toContainText('/cyberx/awareness');
  await run('date');
  await expect(output).toContainText(new Date().getFullYear().toString());
  expect(errors).toEqual([]);

  await page.keyboard.press('Escape');
  await expect(page.locator('#terminal-overlay')).not.toHaveClass(/open/);
  await page.locator('.terminal-btn').click();
  await expect(page.locator('#terminal-overlay')).toHaveClass(/open/);
  await page.locator('#terminal-overlay > .terminal-window .terminal-header span[onclick="closeTerminal()"]')
    .evaluate(element => element.click());
  await expect(page.locator('#terminal-overlay')).not.toHaveClass(/open/);
});

test('navigate and legacy --nav open configured pages and homepage sections', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('.terminal-btn').click();
  const input = page.locator('#t-input');
  await input.fill('navigate dashboard');
  await input.press('Enter');
  await page.waitForURL('**/dashboard.html');
  await expect(page.locator('main h1')).toBeVisible();

  await page.goto('/index.html');
  await page.locator('.terminal-btn').click();
  await input.fill('navigate red team');
  await input.press('Enter');
  await page.waitForURL('**/index.html#red-team');
  await expect(page.locator('#red-team')).toBeInViewport();

  await page.goto('/index.html');
  await page.locator('.terminal-btn').click();
  await input.fill('--nav puzzle');
  await input.press('Enter');
  await page.waitForURL('**/puzzle.html');
  await expect(page).toHaveURL(/puzzle\.html$/);
});
