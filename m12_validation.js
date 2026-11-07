const { chromium } = require('@playwright/test');
(async () => {
  const pages = [
    'index.html','learning.html','puzzle.html','dashboard.html','pricing.html','auth.html','profile.html','leaderboard.html','community.html','resources.html','assistant.html','awareness.html','admin.html'
  ];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];
  for (const p of pages) {
    const url = 'http://127.0.0.1:4173/' + p;
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror:' + e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push('console:' + msg.text()); });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    const title = await page.title();
    const hrefs = await page.locator('a[href]').count();
    const bodyText = await page.locator('body').innerText();
    results.push({ page: p, title, hrefs, textSnippet: bodyText.slice(0, 180), errors: errors.slice(0, 5) });
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();
