# CyberX UI, Pricing, and Navigation Report

Updated 2026-11-07.

## Changes

- Pricing now displays Starter **$5/mo**, Pro **$10/mo**, and Team **$15/mo**. The plan buttons report that checkout and sales are demo-only because no payment or sales backend is connected.
- Shared form controls use the CyberX blue surface, readable placeholders, cyan focus rings, disabled states, and dark dropdown options. Matching overrides cover the home terminal and experience form, puzzle submission fields, and Admin forms.
- Dashboard statistic and content grids use shrinkable columns, wrap long text, size cards to content, and keep spacing between sections.
- Shared-shell pages build the same accessible category navigation from `assets/js/cyberx-app.js`; dropdowns support hover, focus, click, Escape, and a grouped mobile menu. The homepage, awareness, and puzzle pages keep their original navigation styling, link to major sections, and retain accessible mobile navigation. Admin navigation remains separate.

## Verification

- Full Playwright regression suite: **49 passed** (`npm.cmd test -- --reporter=line`). This includes the Admin, puzzle validation, and Supabase contract checks.
- Browser review: 12 primary pages loaded at 1440×900, 1280×800, 768×1024, 390×844, and 320×720. Checks covered page overflow, pricing values, dashboard card intersections, mobile menu expansion, and desktop dropdown hover/click. No issues were reported.
- Screenshots captured or refreshed in `docs/design/screenshots/`: `dashboard-desktop.png`, `pricing-desktop.png`, `navigation-desktop.png`, `assistant-mobile.png`, `auth-mobile.png`, `community-input.png`, `index-mobile.png`, `puzzle-mobile.png`, and `awareness-mobile.png`. They were visually reviewed.

## Scope notes

- The repository has no separate module detail or challenge detail HTML routes, so navigation points to existing pages and section anchors only.
- Authentication, payment processing, sales contact, and the AI assistant remain demo behavior; these changes do not connect a backend.

## Terminal navigation follow-up (2026-11-08)

- Added `assets/js/cyberx-navigation.js` as the shared homepage registry for the ordered public categories, link names, destinations, aliases, and availability. Both homepage desktop/mobile navigation and the terminal use the same entries.
- Added terminal commands `help`, `pages`, `menu`, and `navigate <page>`; expanded legacy `--nav <page>` to use the shared registry while retaining its old syntax. Existing terminal commands, parser/history/keyboard handling, UI, and open/close behavior remain in place.
- Verified the page destinations and homepage anchors against existing files/IDs. Admin remains outside the public navigation list; no Admin authorization change is claimed. Pricing remains reachable under Account because it is an existing public page already present in the former homepage menu.
- Added Playwright coverage for shared desktop/mobile link parity, route existence, aliases, suggestions, unknown destinations, existing terminal commands, open/close behavior, and navigation to a page and homepage section.
- Targeted terminal navigation suite: **3 passed**. Final full Playwright suite: **56 passed**, including terminal, Community, M6, Admin, and Supabase static-contract checks. The M6 Node handler contract remained **16/16 passed**. `git diff --check` passed. No production service was contacted.
