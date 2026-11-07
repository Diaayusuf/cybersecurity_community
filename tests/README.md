# CyberX Admin Playwright tests

## Install and run

Use the repository's existing Node.js installation. On Windows PowerShell, call
npm.cmd to avoid PowerShell execution-policy issues with npm.ps1.

    npm.cmd install
    npm.cmd exec -- playwright install chromium
    npm.cmd test
    npm.cmd run test:admin
    npm.cmd run test:headed
    npm.cmd run test:report

test:report serves the generated HTML report on loopback. The Playwright
configuration also writes a terminal list report. Screenshots, videos, and
traces are disabled by default.

## Test architecture

- helpers/admin-fixtures.mjs creates a new, non-persistent browser context
  for each test, generates a fresh test-only password, seeds synthetic storage,
  blocks non-local requests, tracks runtime errors, and closes each context.
- The admin.*.spec.mjs files cover authentication, dashboard, media, puzzles,
  URL policy, XSS, storage integrity, deletion, export, responsive rendering,
  and runtime/network checks.
- admin.smoke.spec.mjs retains the original dashboard smoke test.
- scripts/serve-static.mjs serves the static site only on 127.0.0.1.

## Isolated authentication and test data

Each context gets a cryptographically random temporary password in memory.
The fixture writes it to cyberx_admin_pwd_v1 in that context before
application scripts execute, then enters it using the normal Admin form. The
fixture does not read or use the application's fallback password, does not use
CYBERX_ADMIN_PASSWORD, and does not import a browser profile or storage state.
The password is not persisted outside the temporary context or printed.

Media and puzzle records use synthetic IDs and synthetic-only values. They are
created in the isolated context and disappear when it closes. No user browser
data or production records are loaded. The test suite never navigates to
puzzle.html.

These tests cover the client-side Admin login UI and application flows. They do
not certify client-side authentication as secure and do not authenticate against
a backend.

## Network policy

Only requests to http://127.0.0.1:4173 are allowed. The existing Google Fonts
stylesheet request is fulfilled with an empty stylesheet by Playwright; no
external font service is contacted. Other external requests are aborted and
counted as unexpected. Supabase, production APIs, and external links are not
visited.

## Verified Admin selector map

| Area | Selectors / controls |
|---|---|
| Authentication | #password-gate, #gate-input, #gate-err, button AUTHENTICATE |
| Dashboard | #page-dashboard, #stat-total-media, #stat-total-pdf, #stat-total-video, #stat-total-puzzle, #recent-media-tbody, #dashboard-puzzles |
| Media library | #page-media, #filter-module, #filter-type, #media-lib-tbody, #media-lib-empty |
| Add media | #page-add-media, #media-module, #media-title, #media-desc, #media-url, #media-meta, #media-preview-block, #media-preview-body |
| Puzzle list | #page-puzzles, #puzzles-list, #puzzles-empty |
| Add puzzle | #page-add-puzzle, #puz-title, #puz-desc, #puz-flag, #puz-difficulty, #puz-url, #hints-container, .hint-input, .hint-remove |
| Delete confirmation | #delete-modal, #delete-target-name, #confirm-delete-btn, CANCEL button |
| Settings / bulk delete | .sidebar-item named SETTINGS, buttons DELETE ALL MEDIA, DELETE ALL PUZZLES, WIPE ALL DATA |
| Export | #page-export, #export-output, buttons EXPORT MEDIA JSON, EXPORT PUZZLES JSON, EXPORT ALL |

The Media Library has module and type filters but no search field or edit controls. Media and puzzle deletion plus bulk deletion are supported. Export displays JSON in the page and does not download a file.

Responsive coverage includes viewports 1440 x 900, 768 x 1024, 390 x 844, and 320 x 740; all seven sections; mobile menu open/close behavior; layout bounds; forms; puzzle cards; export; and cancel-only delete confirmation. Tables use internal horizontal scrolling on narrow screens.

## Windows troubleshooting

- If npm is blocked by PowerShell policy, use npm.cmd.
- If Chromium is missing, run npm.cmd exec -- playwright install chromium.
- The default verification server uses port 4174 to avoid stale 4173 conflicts.
- If an older 4173 listener is present, identify and stop only the verified stale CyberX process before reusing that port.
- The server listens only on 127.0.0.1; it is not a LAN or production server.

