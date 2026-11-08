# CyberX implementation checklist

This checklist is a reviewable roadmap, not authorization to begin major implementation. Preserve existing features, CyberX visual design/colors, and the current Admin Dashboard. Production Supabase changes and deployment require separate review and approval.

## Gate 0 — Audit review

- [ ] Confirm intended branch; checkout is currently `main`, not `feat/cyberx-complete-implementation`.
- [ ] Confirm the pre-existing `admin.html` worktree modification remains preserved.
- [ ] Review six audit documents and agree on scope, data persistence, admin identity, privacy, and deployment strategy.
- [ ] Triage the exposed database-password-like string as a possible credential; owner verifies validity and rotates if real.

## Gate 1 — Feature and design baseline

- [ ] Capture acceptance steps for home, nine learning modules, terminal commands, hidden puzzle navigation, awareness page/checklist, puzzle/Hall of Fame, and every admin workflow.
- [ ] Inventory image use and duplicate-looking assets; preserve all assets until verified.
- [ ] Record CyberX colors, typography, layout, responsive behavior, and intentional differences among pages.
- [ ] Define public file allowlist and authoring-only material.

## Gate 2 — Security and trust boundaries

- [ ] Remove real credentials and internal puzzle solutions from browser-delivered files and verify historical exposure is handled.
- [ ] Fix experience-feed DOM injection with safe text rendering.
- [ ] Define server-enforced admin authentication/authorization without rebuilding the dashboard UI.
- [ ] Review staging Supabase RLS, grants, schema constraints, Realtime publication, and anonymous access.
- [ ] Enforce normalized unique names and field/size constraints in the database.
- [ ] Limit public reads to intended Hall of Fame display fields; prevent public update/delete.
- [ ] Decide server-side puzzle completion validation and anti-abuse controls.
- [ ] Define personal-data notice, purpose, retention, moderation, and deletion workflow.
- [ ] Review admin dynamic HTML, event-handler strings, URL protocols, and stored data as untrusted input.

## Gate 3 — Data continuity

- [ ] Decide whether admin localStorage remains an offline/demo mode or is migrated to shared persistence.
- [ ] Document current localStorage keys and export formats; test export/import round trips.
- [ ] Define schema and migration/rollback strategy in a non-production environment.
- [ ] Back up data before any separately approved production migration.

## Gate 4 — Incremental implementation

- [ ] Preserve all existing page routes, feature behavior, assets, and visual identity.
- [ ] Keep current Admin Dashboard UI and workflows; change its persistence/security implementation behind the existing interface only after review.
- [ ] Extract shared tokens/styles/scripts incrementally and verify each page after each change.
- [ ] Fix encoding issues using confirmed UTF-8 source and visual review.
- [ ] Add CSP/security headers in report-only mode, then enforce after inline code and external dependencies are addressed.
- [ ] Keep secrets and authoring notes outside static output.

## Gate 5 — Verification and release readiness

- [ ] Validate feature parity, responsive layouts, keyboard navigation, focus, labels, and reduced-motion behavior.
- [ ] Test malicious inputs and policy boundaries against staging only.
- [ ] Confirm public build excludes notes, credentials, solutions, Git metadata, and admin-only data.
- [ ] Review Wasmer routing, headers, HTTPS, caching, and direct page URL behavior.
- [ ] Prepare rollback and monitoring plan; separately approve production Supabase changes and deployment.
- [ ] Do not commit or push until explicitly requested.

## M7 — Local Supabase setup and integration status (2026-11-08)

Status: **incomplete; local database verification is blocked by the unavailable Docker engine and Supabase CLI.** Do not treat this milestone as complete based on checked-in files or mocked tests.

- [x] Repository contains isolated Supabase project config (`supabase/config.toml`), the incremental M5/M6 migrations, and the `submit-puzzle` Edge Function.
- [x] M5/M6 SQL, function contract, and test reports were inspected. Existing reports document 16 Node handler tests, 3 M6 browser tests, and the earlier 49-test browser baseline; the current regression results are recorded in `docs/testing/m11-3-frontend-qa-report.md`.
- [ ] Apply M5/M6 migrations to local PostgreSQL and verify tables, indexes, constraints, RLS, policies, effective role grants, Realtime, and function RPC behavior. On 2026-11-08, Docker CLI was present but could not connect to the Docker Desktop Linux engine; Supabase CLI and `psql` were unavailable. No containers were modified, and no production or remote database was contacted.
- [ ] Run the Edge Function against local Postgres. The passing Node tests use synthetic RPC mocks; they do not establish live transactional, permission, rate-limit, or idempotency behavior.
- [ ] Community has no backend schema or authentication integration in the checked-in architecture. Its frontend contract explicitly describes posts, voting, comments, and moderation as demo UI with no persistence. Keep it demo-only until an authenticated, reviewed backend contract and usable local stack exist; no anonymous-author bypass or competing schema was introduced.

## M8 — Security and functional hardening status (2026-11-08)

Status: **incomplete; local frontend and mocked contract checks pass, while authorization requiring a real backend remains unverified.**

- [x] Existing M6 synthetic contract coverage includes request tampering, rejected client-asserted correctness/score fields, bounded rate-limit behavior, idempotency, and mocked concurrency. See `docs/testing/m6-puzzle-test-report.md`.
- [x] Current Admin browser suite exercises the UI gate, isolated synthetic storage, hostile stored text, URL validation, and destructive-action confirmations. These checks prove frontend behavior only.
- [x] Community composer now validates and bounds text, trims input, guards repeated submits, renders user values through DOM text nodes, and labels local-only post/vote/comment feedback accurately. New browser tests exercise XSS-shaped title/body text, duplicate submission, one local vote per card, comments, empty feed, and form feedback.
- [ ] Admin gate remains a client-side password check backed by localStorage, not server-enforced authentication. Protecting real admin data/actions requires an established auth/backend contract; no real role/authorization claim is made.
- [ ] Verify anonymous, authenticated, and administrator RLS/authorization; live function rate limits/concurrency; Community ownership/moderation; and protected Admin operations against an isolated local/staging backend. Docker/Supabase runtime unavailability prevented these checks.

## Community correction status (2026-11-08)

- [x] Create Post controls use the existing CyberX form tokens and a scoped vertical grid; the desktop feed/composer grid has bounded columns and stacks at tablet/mobile widths.
- [x] Required title/category/content, 120/5,000-character limits, trimming, inline errors, disabled/loading state, safe text-only rendering, category badge, empty-feed state, and explicit local-demo success/failure feedback are implemented.
- [x] Existing Comments remain non-persistent demo notices. Likes remain one local UI increment per card and are not trusted or persisted. No Community backend or authentication was available, so success means inserted into this page session only.
- [x] Playwright layout checks pass at 1920, 1440, 1280, 1024, 768, 390, 375, and 320 CSS pixels. Screenshots are stored in `docs/testing/community-m7m8-screenshots/`.
