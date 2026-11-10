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

test('navbar height, logo size, hover area, and alignment match the compact homepage reference', async ({ page }) => {
  test.setTimeout(180_000);
  const logoSelectors = {
    'index.html': '#main-nav .logo img',
    'admin.html': '.topbar-logo img',
    'assistant.html': '.header .brand img',
    'auth.html': '.header .brand img',
    'awareness.html': '.header .brand img',
    'community.html': '.header .brand img',
    'dashboard.html': '.header .brand img',
    'learning.html': '.header .brand img',
    'leaderboard.html': '.header .brand img',
    'pricing.html': '.header .brand img',
    'profile.html': '.header .brand img',
    'puzzle.html': '.site-nav .nav-logo img',
    'resources.html': '.header .brand img',
  };
  const neighborSelectors = {
    'index.html': ['#main-nav .logo', '.home-mobile-toggle', '.home-nav-desktop'],
    'admin.html': ['.topbar-logo', '.mobile-menu-toggle', '.topbar-right'],
    'assistant.html': ['.header .brand', '.mobile-toggle', '.nav'],
    'auth.html': ['.header .brand', '.mobile-toggle', '.nav'],
    'awareness.html': ['.header .brand', '.mobile-toggle', '.nav'],
    'community.html': ['.header .brand', '.mobile-toggle', '.nav'],
    'dashboard.html': ['.header .brand', '.mobile-toggle', '.nav'],
    'learning.html': ['.header .brand', '.mobile-toggle', '.nav'],
    'leaderboard.html': ['.header .brand', '.mobile-toggle', '.nav'],
    'pricing.html': ['.header .brand', '.mobile-toggle', '.nav'],
    'profile.html': ['.header .brand', '.mobile-toggle', '.nav'],
    'puzzle.html': ['.site-nav .nav-logo', '.site-nav > .nav-back', '.site-nav > .nav-back'],
    'resources.html': ['.header .brand', '.mobile-toggle', '.nav'],
  };
  const navbarSelectors = {
    'index.html': '#main-nav', 'admin.html': '.topbar', 'puzzle.html': '.site-nav',
    'assistant.html': '.header', 'auth.html': '.header', 'awareness.html': '.header',
    'community.html': '.header', 'dashboard.html': '.header', 'learning.html': '.header',
    'leaderboard.html': '.header', 'pricing.html': '.header', 'profile.html': '.header',
    'resources.html': '.header',
  };
  const logoWrapperSelectors = {
    'index.html': '#main-nav .logo',
    'admin.html': '.topbar-logo img',
    'assistant.html': '.header .brand',
    'auth.html': '.header .brand',
    'awareness.html': '.header .brand',
    'community.html': '.header .brand',
    'dashboard.html': '.header .brand',
    'learning.html': '.header .brand',
    'leaderboard.html': '.header .brand',
    'pricing.html': '.header .brand',
    'profile.html': '.header .brand',
    'puzzle.html': '.site-nav .nav-logo',
    'resources.html': '.header .brand',
  };
  const viewports = [
    [1440, [168, 44], [48, 19.2], 83.4],
    [1200, [168, 44], [48, 19.2], 83.4],
    [1024, [168, 44], [48, 19.2], 83.4],
    [768, [168, 44], [24, 16], 77],
    [390, [140, 37], [16, 11.2], 60.4],
    [320, [140, 37], [16, 11.2], 60.4],
  ];
  for (const [width, expectedSize, expectedPosition, expectedNavHeight] of viewports) {
    await page.setViewportSize({ width, height: 844 });
    for (const [route, selector] of Object.entries(logoSelectors)) {
      await page.goto(`/${route}`, { waitUntil: 'domcontentloaded' });
      const logo = page.locator(selector);
      await expect(logo).toBeVisible();
      const bounds = await logo.boundingBox();
      expect([bounds?.width, bounds?.height], `${route} size at ${width}px`).toEqual(expectedSize);
      expect(bounds?.x, `${route} left edge at ${width}px`).toBeCloseTo(expectedPosition[0], 0);
      expect(bounds?.y, `${route} top edge at ${width}px`).toBeCloseTo(expectedPosition[1], 0);
      await expect(logo).toHaveCSS('object-fit', 'cover');

      const wrapper = page.locator(logoWrapperSelectors[route]).first();
      const wrapperBounds = await wrapper.boundingBox();
      expect([wrapperBounds?.width, wrapperBounds?.height], `${route} hover target at ${width}px`).toEqual(expectedSize);
      if (route !== 'admin.html') {
        await wrapper.hover();
        await wrapper.focus();
        await expect(wrapper).toBeFocused();
      }

      const [brandSelector, compactControlSelector, desktopNavSelector] = neighborSelectors[route];
      const compactControl = page.locator(compactControlSelector).first();
      const controlSelector = await compactControl.isVisible()
        ? compactControlSelector
        : desktopNavSelector;
      const brandBounds = await page.locator(brandSelector).boundingBox();
      const controlBounds = await page.locator(controlSelector).first().boundingBox();
      expect(brandBounds, `${route} logo should be measurable at ${width}px`).not.toBeNull();
      expect(controlBounds, `${route} navigation control should be measurable at ${width}px`).not.toBeNull();
      const separated = brandBounds.x + brandBounds.width <= controlBounds.x
        || controlBounds.x + controlBounds.width <= brandBounds.x
        || brandBounds.y + brandBounds.height <= controlBounds.y
        || controlBounds.y + controlBounds.height <= brandBounds.y;
      expect(separated, `${route} logo must not overlap navigation at ${width}px`).toBe(true);
      expect(brandBounds.x + brandBounds.width, `${route} logo should fit within viewport at ${width}px`)
        .toBeLessThanOrEqual(width);
      const navbar = await page.locator(navbarSelectors[route]).evaluate(element => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        height: element.getBoundingClientRect().height,
        overflowX: getComputedStyle(element).overflowX,
      }));
      expect(navbar.height, `${route} navbar height at ${width}px`).toBeCloseTo(expectedNavHeight, 0);
      if (route === 'puzzle.html' && width <= 960) {
        expect(navbar.overflowX, 'Puzzle keeps its existing links in a compact horizontal scroller').toBe('auto');
      } else {
        expect(navbar.scrollWidth, `${route} navbar should not overflow at ${width}px`)
          .toBeLessThanOrEqual(navbar.clientWidth);
      }
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
