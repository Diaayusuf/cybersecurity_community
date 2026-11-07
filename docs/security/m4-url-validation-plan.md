# CyberX P1 M4 URL Validation Policy and Implementation Plan

Review date: 2026-11-07
Repository: `C:\Users\Diaa\Documents\GitHub\cybersecurity_community`
Branch: `feat/cyberx-complete-implementation`
Scope: read-only URL review and plan. No application source, localStorage, Supabase, or user data was changed.

## Executive policy proposal

Use one browser-`URL`-API validator for Admin media and puzzle URLs. The baseline policy is:

- Accept absolute `https:` URLs with a non-empty hostname and no user information.
- Do not accept `http:` by default. The tracked content URLs reviewed are HTTPS; actual browser-local records could not be inspected in this session. Before rollout, perform a read-only URL-only inventory of the two Admin storage collections. If a legitimate legacy HTTP origin is found, require explicit owner approval and allow only that exact origin as a compatibility exception.
- For `puzzle.url` only, accept the explicitly documented same-origin relative route `puzzle.html` (and the equivalent `./puzzle.html` form). Resolve it against `document.baseURI`, require the same origin, and require its normalized path to equal the existing `puzzle.html` route. Do not allow media-relative paths, root-relative paths, traversal paths, arbitrary same-origin pages, or protocol-relative URLs without separate product approval.
- Reject credentials, all other schemes, control-character or backslash obfuscation, malformed URLs, and internal whitespace. Trim ordinary leading/trailing spaces after rejecting control characters; return the canonical `URL.href`.
- When links are restored, set `target="_blank"` and `rel="noopener noreferrer"` on every new-tab anchor.

This policy does not infer file type from a URL suffix or host. Existing Admin media types are content labels, while current source links include documentation landing pages and video search/watch pages rather than only direct file URLs.

## Findings and current URL flows

Line numbers refer to the reviewed post-M3 `admin.html`.

| Flow | Source / sink | Current behavior and M4 treatment |
|---|---|---|
| Media creation | `#media-url` input L784; `saveMedia()` L1207-L1234 | URL is required, trimmed, then stored as `item.url`. M3 checks that it is a bounded string only; it does not check scheme or origin. M4 must validate before `saveMedia2()` and leave the form/storage unchanged on rejection. There is no media edit-existing-record UI or edit function in the current Admin page; current operations are create, clear, list/filter, delete, and export. |
| Puzzle creation | `#puz-url` input L876; `savePuzzle()` L1430-L1458 | URL is optional, trimmed, then stored as `item.url`. M4 should continue to allow a blank optional field; validate a non-empty value before persistence. There is no puzzle edit-existing-record UI or edit function. |
| Existing media storage | keys read through `loadMedia()` / `readRecordSet()` around L1023 and L1110-L1131 | URL fields are type/length checked, not scheme checked. Existing raw URLs are not currently changed by M3. M4 must validate stored values at render time in addition to validating new form submissions. A rejected legacy URL must not cause the row itself to disappear or rewrite its record. |
| Media library row | `createMediaRow()` L1301-L1312, called by `renderMediaTable()` L1313 onward | M3 currently emits an unavailable placeholder with no `href`. M4 can replace it with a link only when the stored URL validator accepts the value. |
| Recent-media dashboard row | `renderDashboard()` L1343 onward, URL placeholder near L1374-L1377 | M3 currently emits an unavailable placeholder with no `href`. Use the same validator and same new-tab attributes as the media table. |
| Puzzle card | `puzzleCardHTML()` L1501 onward, optional URL placeholder near L1580-L1582 | M3 currently emits an unavailable placeholder only when a non-empty URL exists. M4 may restore it only for a validated external HTTPS URL or the approved `puzzle.html` same-origin route. |
| Export | `exportData()` L1647-L1669 | Media URLs are included in the media and grouped-media JSON; puzzle records are exported as stored. Keep this JSON shape and preserve raw stored URL strings. Validation must not canonicalize or rewrite existing localStorage values as a side effect of rendering/export. |
| Media preview | `updateMediaPreview()` | The URL input triggers a preview refresh but the URL itself is not displayed or linked in the preview. No M4 URL sink exists there. |

The disabled M3 placeholders at the three link-rendering points above should remain in place until M4 is implemented. Static internal navigation anchors elsewhere in the pages are not localStorage-driven and are outside this M4 Admin URL change.

## Existing content and route evidence

- `index.html` contains 59 `url:` declarations reviewed: 54 absolute HTTPS content destinations and five same-page/local navigation values. External destinations include documentation/reference sites (for example OWASP, MITRE ATT&CK, YARA documentation, and standards references) and YouTube watch or search pages. YouTube URLs use query parameters, so the validator must preserve valid queries rather than strip them.
- The content labelled PDF is not consistently a direct `.pdf` download; several current URLs resolve to documentation or project pages. The content labelled video includes both individual YouTube watch pages and YouTube search pages. M4 must not require `.pdf`, `.mp4`, a MIME type, an embed URL, or a fixed host allowlist.
- The repository has the local HTML routes `index.html`, `puzzle.html`, `admin.html`, and `awareness.html`. The puzzle form placeholder explicitly gives `puzzle.html` as a linked-page example. M4 should allow only that route in the puzzle URL field until other local destinations are demonstrated and approved. `awareness.html` exists but was not identified as a current Admin URL use case.
- No local `.pdf`, `.mp4`, `.webm`, `.m3u8`, or `.mov` assets and no tracked JSON/CSV/YAML URL fixtures were found. The `http://` text in `awareness.html` is an example phishing address rendered as explanatory text, not a clickable Admin content URL. SVG `xmlns="http://www.w3.org/2000/svg"` values are XML namespaces, not navigation destinations.
- The current Admin form describes media URLs with an HTTPS placeholder and puzzle links with a `puzzle.html` example. No media or puzzle edit-existing-record path exists in this version.
- Browser-local media/puzzle URL values are outside the repository. A read-only inspection of the active browser could not be completed because Computer Use stopped when it could not determine the current browser URL with enough confidence to enforce its safety policy. No browser storage was read or changed. Therefore this review cannot certify that no legacy HTTP or other relative URLs exist in a user's browser profile.

## Reusable validator design

Implement a single helper, for example `validateAdminUrl(raw, { kind, baseUrl })`, returning a canonical URL string on success or `null` on rejection. `kind` is `media` or `puzzle`; it controls only the explicitly approved relative-route exception. The helper should:

1. Require a string no longer than the existing 4096-character storage cap. The media form requires a non-empty result; the puzzle form may remain blank.
2. Reject C0/C1 controls, DEL, tabs/newlines, backslashes, and internal whitespace before constructing `URL`. Trim ordinary surrounding spaces to match the current form behavior. Reject protocol-relative values beginning with `//`.
3. If an explicit scheme is present, require an absolute `https://` URL. Reject `javascript:`, `data:`, `vbscript:`, `file:`, `blob:`, `ftp:`, `mailto:`, and all unknown schemes. Require a parsed hostname and reject non-empty `username` or `password`; also reject user-info syntax in the authority even if the user-info portion is empty.
4. For the conditional HTTP compatibility path, keep HTTPS as the default. Only after the storage inventory and owner approval, permit `http:` for an explicit set of legacy origins; do not turn on generic HTTP acceptance.
5. If no scheme is present, allow it only when `kind === 'puzzle'` and the raw path is exactly `puzzle.html` or `./puzzle.html`, without query or fragment. Resolve with `new URL(value, baseUrl)` and require the same origin and normalized route path as `new URL('puzzle.html', baseUrl)`. Reject all other relative and root-relative values.
6. Return `parsed.href` for absolute values and the resolved canonical route for the approved relative case. Do not assign an `href` or create a clickable anchor when the helper returns `null`.

Keep validation separate from `isValidMediaRecord()` / `isValidPuzzleRecord()` shape checks. An otherwise valid legacy record with a rejected URL should remain visible and actionable for non-link operations; only its link stays unavailable. This avoids hiding or dropping stored records and avoids turning URL migration into a storage rewrite.

## Allowed and rejected examples

Examples are policy examples, not current stored user data.

| Input | Decision | Reason |
|---|---|---|
| `https://docs.example.org/guide` | Allow | HTTPS with a host |
| `https://www.youtube.com/watch?v=example` | Allow | HTTPS; preserve query parameters used by current video URLs |
| `https://training.example.org/search?q=blue+team` | Allow | HTTPS query strings are valid |
| `puzzle.html` in `puzzle.url` | Allow | Explicit existing same-origin route example |
| `./puzzle.html` in `puzzle.url` | Allow | Same route after URL normalization |
| `http://docs.example.org/guide` | Reject by default | No HTTP content URL was found in tracked Admin/source examples; only consider an owner-approved exact-origin exception after inventory |
| `javascript:alert(1)` | Reject | Active script scheme |
| `data:text/html,...` | Reject | Active data document scheme |
| `vbscript:...`, `file:///...`, `blob:...`, `ftp://...`, `mailto:...` | Reject | Unsupported/non-navigation scheme for these content links |
| `//example.org/path` | Reject | Protocol-relative destination is not explicitly approved |
| `https://user:pass@example.org/` | Reject | Embedded credentials |
| `https://example.org/a b` | Reject | Internal whitespace is ambiguous; percent-encode URL data explicitly |
| `java\nscript:alert(1)` or a tab/control-obfuscated scheme | Reject | Raw controls are rejected before browser URL normalization |
| `../puzzle.html`, `/puzzle.html`, `awareness.html`, `puzzle.html?next=...` | Reject under current allowlist | Not the exact documented puzzle route form; extend only after a use case is approved |

## Implementation plan

1. **Inventory before rollout:** perform a URL-only read of current localStorage values for both keys in a controlled browser profile. Do not display puzzle flags, titles, or other fields. Record only counts by scheme and whether values match the proposed puzzle route allowlist. Do not write to storage.
2. Add the shared `validateAdminUrl()` helper and small tests. Keep URL validation separate from record-shape validation and keep all raw stored values unchanged.
3. In `saveMedia()`, reject invalid URL values before constructing/persisting a record; keep form values in place on rejection. In `savePuzzle()`, preserve blank as optional but reject an invalid non-empty URL before persistence.
4. In `createMediaRow()` used by `renderMediaTable()`, `renderDashboard()` and `puzzleCardHTML()`, validate the stored URL again. For valid URLs create anchors using DOM APIs and assign the canonical result to `.href`; for invalid/empty URLs retain the M3 disabled placeholder. For anchors opened in a new tab, set `target = '_blank'` and `rel = 'noopener noreferrer'`.
5. Preserve all other record data, CRUD, filters, ordering, confirmations, styling, and JSON export. Do not auto-update existing HTTP URLs to HTTPS, remove them, or change localStorage keys. Keep an unavailable state for unsupported legacy values and document a separate owner-managed migration route if any are found.
6. Run unit/regression tests, syntax checks, `git diff --check`, and visual checks at the static host's root and any deployment subpath where relative routes are supported.

## Regression tests

- **Validator unit cases:** allowed HTTPS pages, YouTube watch/search query URLs, case-normalized HTTPS, the approved `puzzle.html` route, and `./puzzle.html`; rejected HTTP default, JavaScript/data/VBScript/file/blob/unknown schemes, malformed URLs, credentials, protocol-relative paths, `/puzzle.html`, traversal paths, unsupported relative pages, internal whitespace, backslashes, CR/LF/TAB/C0/C1 controls, and empty required media input. Verify accepted output is canonical and rejected input returns `null`.
- **Compatibility inventory fixtures:** test a legacy HTTP value and each previously stored relative value as data only. Confirm no value is rewritten during page load, export, or rendering; unsupported values remain stored and have no clickable link.
- **Create flows:** verify media URL is required and validation runs before storage; puzzle URL remains optional; invalid values do not call `saveMedia2()`/`savePuzzles()` or clear the form; valid values persist in the existing record fields and keys.
- **All render points:** test media library rows, recent dashboard rows, and full puzzle cards with valid HTTPS, approved relative puzzle route, blank puzzle URL, and rejected legacy values. Accepted anchors use the canonical `.href`, `target="_blank"`, and exact `rel="noopener noreferrer"`; rejected values stay non-clickable and do not hide the record.
- **Content type behavior:** accept HTTPS documentation landing pages for PDF-labelled media and YouTube watch/search pages for video-labelled media without requiring file suffixes, MIME checks, or a host allowlist.
- **User input edge cases:** uppercase schemes, surrounding spaces, query strings, fragments on absolute HTTPS URLs, Unicode/IDN host canonicalization, percent-encoded path/query data, oversized values, and URL values containing event/markup characters. Verify the URL is never inserted into HTML strings.
- **Migration:** verify unknown fields, record order, CRUD, filtering, delete confirmations, counts, and export shape remain unchanged. Confirm localStorage bytes do not change unless the user explicitly creates/deletes a record.
- Do not navigate to external test URLs during automated checks; validate and inspect constructed anchors offline.

## Decisions for review

1. Approve HTTPS-only baseline. If the storage inventory finds a legitimate HTTP link, approve or reject an exact-origin exception explicitly.
2. Approve `puzzle.html` and `./puzzle.html` as the only relative Admin route for now. Decide separately before adding `awareness.html`, root-relative paths, query strings, or fragments.
3. Confirm external links should continue opening in a new tab; this plan recommends preserving current behavior with `rel="noopener noreferrer"`.
4. Confirm media relative paths are out of scope unless a real self-hosted PDF/video use case and path root are identified.
5. Confirm the rollout owner for reviewing legacy localStorage URLs, because those values are not tracked in Git and were unavailable to this read-only source review.

## Review status and limits

Repository root: `C:/Users/Diaa/Documents/GitHub/cybersecurity_community`
Branch: `feat/cyberx-complete-implementation`
Initial/final worktree status: `admin.html`, `index.html`, and `puzzle.html` modified; `docs/` untracked. Existing worktree changes were preserved.

This plan is based on source and tracked-file review. No browser localStorage, user data, Supabase, deployment, or external website was changed. No commit, push, or deployment was performed.