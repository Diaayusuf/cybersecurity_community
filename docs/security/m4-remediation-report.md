# CyberX P1 M4 Remediation Report — Admin URL Validation

Date: 2026-11-07

## Changes

- Added the reusable `validateAdminUrl(raw, kind)` helper in `admin.html`, backed by the browser `URL` API. Absolute URLs are accepted only when HTTPS, with a hostname and no URL user information. Puzzle records additionally accept only the exact relative strings `puzzle.html` and `./puzzle.html`, resolved against the current document and checked for same-origin route equivalence.
- Rejected HTTP, unsafe and unknown schemes, credentials (including empty user-info syntax), protocol-relative URLs, controls, backslashes, internal whitespace, unsupported relative paths, relative queries/fragments, and values over the existing URL size limit.
- `saveMedia()` requires a non-empty accepted HTTPS URL before persistence. `savePuzzle()` continues to allow a blank URL and validates every non-empty value. New accepted inputs are persisted as canonical `URL.href` values.
- Replaced the unavailable state with validated DOM-created anchors at `createMediaRow()`, `renderDashboard()`, and `puzzleCardHTML()`. Anchors use the canonical URL through the `.href` property, `target="_blank"`, and `rel="noopener noreferrer"`. Rejected and empty legacy media URLs remain unavailable; rejected non-empty puzzle URLs remain visible with an unavailable control. Blank puzzle URLs do not create a link.
- No URL validation was added to storage shape validation. Existing valid-shaped records remain visible even when their URL is rejected. Rendering and export do not rewrite stored URL strings. Existing unknown export fields and all storage keys/record fields are unchanged.

## Validation performed

- Extracted the actual helper from the inline `admin.html` script and ran an isolated Node test matrix. HTTPS documentation URLs, YouTube watch/search URLs, canonical IDN hosts, encoded path/query values, fragments, query parameters, surrounding ordinary spaces, and both approved puzzle routes passed. HTTP, active/unsupported schemes, credentials, protocol-relative URLs, traversal and other relative paths, internal whitespace, controls, backslashes, malformed HTTPS, encoded scheme attempts, and relative query/fragment variants were rejected.
- Checked the source integration for all three rendering locations: `createMediaRow()`, `renderDashboard()`, and `puzzleCardHTML()` call the shared safe-link helper for their record URLs.
- Tested the DOM link helper in an isolated Node context: approved HTTPS and puzzle-route values create anchors with the required `target`/`rel`; rejected HTTP returns an unavailable span without an `href`.
- Tested isolated `saveMedia()` / `savePuzzle()` flows: invalid HTTP is blocked without saving or clearing the form; valid HTTPS media persists; puzzle URLs remain optional and an approved relative puzzle route persists canonically.
- Extracted the inline JavaScript and ran `node --check`: passed.
- Ran `git diff --check`: passed (Git emitted only its existing line-ending advisory for `index.html`).
- No full browser or visual/responsive test was performed.

## Existing data and limitations

- `docs/security/m4-url-inventory.md` records that the browser localStorage inventory could not be performed; actual storage values and the reported legacy URL counts were unavailable. Therefore this remediation does not claim to have verified the user's specific legacy records, including the reported two HTTP media URLs and unsupported puzzle URL.
- The code path preserves those records by keeping URL values out of storage normalization and by making only validator-approved links clickable. To verify the particular stored strings remain unchanged and non-clickable, the owner must repeat a URL-only read-only inventory in the intended browser profile and test those records locally. No browser localStorage, production Supabase, or user data was accessed or changed here.
- Client-side validation is not a security boundary for malicious users who can edit localStorage or invoke page code. It protects this UI's link and creation paths; it does not provide server-side authorization or validate externally imported content elsewhere.
- The URL policy intentionally does not permit arbitrary same-origin paths, relative query/fragment variants, or HTTP exceptions. A new route or scheme requires an explicit policy change and tests.

## Scope and repository safety

- Application changes are limited to `admin.html`; documentation changes are limited to this report and the M4 section of `docs/security/p1-remediation-report.md`.
- Admin authentication, Supabase, database policies, user data, Git history, deployment, commits, and pushes were not changed.
- Existing modifications in `index.html` and `puzzle.html`, and the pre-existing `admin.html` worktree changes, were preserved.
