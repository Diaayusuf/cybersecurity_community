import { randomBytes } from 'node:crypto';
import { test as base, expect } from '@playwright/test';

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4174';
export const STORAGE_KEYS = Object.freeze({
  media: 'cyberx_admin_media_v1',
  puzzles: 'cyberx_admin_puzzles_v1',
  password: 'cyberx_admin_pwd_v1',
});

export function mediaRecord(overrides = {}) {
  return {
    id: 'pw-media-a1',
    type: 'pdf',
    module: 'pen-testing',
    title: 'Synthetic PDF Alpha',
    desc: 'Synthetic media record',
    url: 'https://example.com/cyberx-test-resource',
    size: '1 MB',
    created: '2099-01-01',
    ...overrides,
  };
}

export function puzzleRecord(overrides = {}) {
  return {
    id: 'pw-puzzle-a1',
    title: 'Synthetic Puzzle Alpha',
    desc: 'Synthetic puzzle narrative',
    flag: 'SYNTHETIC_TEST_ONLY',
    difficulty: 'MEDIUM',
    module: 'soc',
    hints: ['Synthetic hint'],
    layers: 'Base64',
    url: '',
    created: '2099-01-01',
    solvers: 0,
    ...overrides,
  };
}

export const DEFAULT_MEDIA = Object.freeze([
  mediaRecord(),
  mediaRecord({
    id: 'pw-media-b2',
    type: 'video',
    module: 'soc',
    title: 'Synthetic Video Beta',
    desc: 'Second synthetic record',
    url: 'https://example.com/cyberx-test-video',
    duration: '12 min',
  }),
  mediaRecord({
    id: 'pw-media-c3',
    module: 'threat-hunt',
    title: 'Synthetic Guide Gamma',
    url: 'https://example.com/cyberx-test-guide',
  }),
]);

export const DEFAULT_PUZZLES = Object.freeze([
  puzzleRecord(),
  puzzleRecord({
    id: 'pw-puzzle-b2',
    title: 'Synthetic Puzzle Beta',
    difficulty: 'HARD',
    url: 'puzzle.html',
    hints: [],
  }),
]);

async function createSession(browser, options = {}) {
  const password = randomBytes(32).toString('base64url');
  const context = await browser.newContext({
    viewport: options.viewport ?? { width: 1440, height: 900 },
  });
  const monitor = {
    pageErrors: [],
    consoleErrors: [],
    failedLocalRequests: [],
    unexpectedExternalRequests: [],
    interceptedFontRequests: 0,
  };

  await context.route('**/*', async route => {
    const requestURL = new URL(route.request().url());
    if (requestURL.origin === BASE_URL) {
      await route.continue();
    } else if (requestURL.hostname === 'fonts.googleapis.com') {
      monitor.interceptedFontRequests += 1;
      await route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    } else {
      monitor.unexpectedExternalRequests.push(true);
      await route.abort();
    }
  });

  const mediaRaw = options.mediaRaw === undefined
    ? JSON.stringify(options.media ?? DEFAULT_MEDIA)
    : options.mediaRaw;
  const puzzlesRaw = options.puzzlesRaw === undefined
    ? JSON.stringify(options.puzzles ?? DEFAULT_PUZZLES)
    : options.puzzlesRaw;

  await context.addInitScript(
    ({ password, mediaRaw, puzzlesRaw, baseURL }) => {
      if (location.origin !== baseURL) return;
      window.__xssExecuted = false;
      if (sessionStorage.getItem('cyberx-pw-fixture-seeded') === '1') return;
      sessionStorage.setItem('cyberx-pw-fixture-seeded', '1');
      localStorage.setItem('cyberx_admin_pwd_v1', password);
      if (mediaRaw !== null) localStorage.setItem('cyberx_admin_media_v1', mediaRaw);
      if (puzzlesRaw !== null) localStorage.setItem('cyberx_admin_puzzles_v1', puzzlesRaw);
    },
    { password, mediaRaw, puzzlesRaw, baseURL: BASE_URL },
  );

  const page = await context.newPage();
  page.on('pageerror', () => monitor.pageErrors.push(true));
  page.on('console', message => {
    if (message.type() === 'error') monitor.consoleErrors.push(true);
  });
  page.on('requestfailed', request => {
    const requestURL = new URL(request.url());
    if (requestURL.origin === BASE_URL) {
      monitor.failedLocalRequests.push(requestURL.pathname);
    }
  });
  page.on('response', response => {
    const responseURL = new URL(response.url());
    if (responseURL.origin === BASE_URL && response.status() >= 400 && responseURL.pathname !== '/favicon.ico') {
      monitor.failedLocalRequests.push(responseURL.pathname);
    }
  });

  const session = {
    context,
    page,
    password,
    monitor,
    async open() {
      await page.goto(BASE_URL + '/admin.html');
      return page;
    },
    async login(value = password) {
      await page.locator('#gate-input').fill(value);
      await page.getByRole('button', { name: /authenticate/i }).click();
    },
    async authenticate() {
      await this.open();
      await this.login();
      await expect(page.locator('#password-gate')).toBeHidden();
      await expect(page.locator('#page-dashboard')).toBeVisible();
      return page;
    },
    async close() {
      await context.close();
    },
  };
  return session;
}

export const test = base.extend({
  adminSessions: async ({ browser }, use) => {
    const sessions = [];
    const factory = async options => {
      const session = await createSession(browser, options);
      sessions.push(session);
      return session;
    };
    try {
      await use(factory);
    } finally {
      for (const session of sessions) await session.close();
      for (const session of sessions) {
        expect(session.monitor.pageErrors, 'uncaught page errors').toHaveLength(0);
        expect(session.monitor.consoleErrors, 'browser console errors').toHaveLength(0);
        expect(session.monitor.failedLocalRequests, 'failed local requests').toEqual([]);
        expect(session.monitor.unexpectedExternalRequests, 'unexpected external requests').toEqual([]);
      }
    }
  },
});

export { expect };


