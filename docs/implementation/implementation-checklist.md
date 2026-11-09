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

## M7 — Local Supabase and backend integration status (2026-11-08)

Status: **partially complete; the local database, Auth, Community, M5/M6 migrations, Edge Function, and puzzle Realtime paths are operational and verified. Dashboard, learning, billing, moderation, and Admin integrations remain incomplete.** All execution targeted the local CyberX Supabase stack; no remote/production project was linked or changed.

- [x] Tooling: Node 24.18.0, npm 11.16.0, Deno 2.9.8, and Docker Engine are available. `supabase` is not currently resolvable on this shell's PATH; the already-running local stack was inspected directly through Docker and PostgreSQL.
- [x] Isolated local stack: API/Kong `http://127.0.0.1:54321`, PostgreSQL `127.0.0.1:54322`, Studio `http://127.0.0.1:54323`, and Mailpit `http://127.0.0.1:54324`. PostgreSQL, Auth, REST, Kong, Storage, Realtime, Studio, Edge Runtime, and Mailpit are running/responding. The optional Vector Docker-log collector is restarting because the Docker Desktop TCP log endpoint refuses connections; core services and tests are unaffected. Wazuh containers were inspected and left unchanged.
- [x] Seven migrations are applied and recorded locally in order: M5 `20261107124827`, M6 `20261107133243`, M7 Auth/Community `20261108150000`, post idempotency `20261108151000`, Community rate limits `20261108152000`, existing-member profile backfill `20261108153000`, and learning progress `20261108154000`.
- [x] M5/M6 read-only SQL verification returned all 18 M6 catalog checks true; effective role tests confirmed anon read access only to intended puzzle fields/views, no public trusted writes, service-role-only RPC execution, private-schema isolation, and Realtime publication membership. M5 constraints and normalized unique-name index are also checked by the M7 read-only verifier.
- [x] `auth.html` supports local sign-up/sign-in, 12-character minimum and confirmation matching, reset email requests and recovery password updates. Supabase SDK session persistence/refresh is enabled. The signup trigger creates a private profile without storing email or trusted roles. Chromium verified account creation, restoration after reload, profile update persistence, invalid-token rejection, and sign-out protection. Local Auth auto-confirm is enabled; production email delivery/verification remains deployment configuration.
- [x] `profile.html` reads/updates only the signed-in member’s profile under RLS. Avatar upload, social links, privacy controls, and public profile pages remain outside the implemented schema.
- [x] Learning path starts persist per user for the three existing catalog paths; the Dashboard shows the signed-in user’s started paths and counts. Lesson completion, achievements, streaks, and skill percentages remain untracked because the catalog has no activity/completion flow.
- [x] Community posts, public-safe feed/comments views, authenticated comments, one-per-member likes, and profile-derived author display are persisted locally. RLS blocks anonymous base-table writes and other members’ profile/post mutations. Six concurrent post attempts resulted in four accepted and two rate-limited after the account’s initial post, matching the 5-post/10-minute limit. Caps are 20 comments and 60 reactions per aligned 10-minute window.
- [x] M6 `submit-puzzle` ran in the local Edge Runtime against local Postgres. Synthetic checks covered incorrect/correct answers, idempotent retry, duplicate normalized name, unknown challenge, malformed input, unauthorized key, and 8-per-10-minute rate cap. A real browser subscription received the verified solve event with only the safe five-column row shape.
- [x] Complete the password reset link round trip in local Mailpit. Chromium retrieved the local reset message, opened the recovery URL, saved a new password, and successfully signed in with it. Local email confirmation is auto-confirmed, so email verification was not exercised.
- [ ] Membership/billing, suggestions/moderation, resource preferences, AI provider calls, Discord metadata, and Admin authorization remain demo-only or unimplemented. The existing Admin localStorage gate is not server authorization. No arbitrary admin role or moderation semantics were introduced.

## M8 — Security and functional hardening status (2026-11-08)

Status: **partially complete; local RLS, owner authorization, tampering, Community XSS, database rate limits, puzzle idempotency, and Realtime payload behavior were tested. Server-side Admin security and broader product authorization remain blockers.**

- [x] Existing `supabase/tests/m6-readonly-verification.sql`: 18/18 checks passed against local Postgres. `supabase/tests/m7-readonly-verification.sql` checks M5 legacy grants/constraints, private profile/base-table isolation, public-safe views, owner-scoped policies, author-ID column restrictions, fixed-path trigger functions, uniqueness, and rate-limit privacy.
- [x] Browser integration tests used two synthetic Auth users. Invalid bearer token returned 401/403; anonymous Community writes failed; another user could not read/update a private profile or delete another user’s post; author-ID tampering was rejected.
- [x] Community title/body/profile payloads containing harmless HTML/script text rendered as literal text; no elements were created. Authenticated comments and public feed read-after-reload were verified.
- [x] Community atomic request limits and concurrent requests were tested in the database. M6 source limit was exercised at its 8 allowed requests then 429; duplicate solve retries returned the same solve and unique name/idempotency constraints prevented duplicate records.
- [x] Puzzle Realtime event was received locally; published payload contained `id`, `challenge_id`, `name`, `domain`, and `verified_at`, with no answer, fingerprint, or private state.
- [ ] Admin actions still have no server-side identity/role check or protected backend operation. Do not treat the browser password gate as security.
- [x] Password reset email-link round trip completed against local Mailpit; the new password authenticated through a fresh client.
- [x] Invalid-token denial, session restoration after reload, and protected profile denial after sign-out were exercised locally. These do not substitute for expired-session refresh testing.
- [ ] Expired-session refresh, moderator workflows, distributed abuse, and XSS/authorization sweeps across every demo page remain unverified. Admin actions still have no server-side identity/role check or protected backend operation.

## Final local verification update (2026-11-08)

- [x] Local Docker inspection confirms the isolated `supabase_*_cyberx-community` stack is running; the five named Wazuh containers remain stopped and untouched. PostgreSQL, Auth/Kong, Studio, and Mailpit loopback checks returned healthy HTTP/TCP responses. The optional Vector collector is restarting.
- [x] Local migration history contains all seven expected migrations. The read-only SQL reports returned 18/18 M6 checks and 15/15 M7 checks passing (both commands exit 0).
- [x] `CYBERX_LOCAL_SUPABASE_TESTS=1; playwright test --reporter=list tests/m7-auth-community.spec.mjs`: 3 passed, 0 failed, 0 skipped (exit 0).
- [x] `npm.cmd test`: 56 passed, 0 failed, 3 local-integration tests skipped by design (exit 0). Those three tests passed in the dedicated local run above.
- [x] `npm.cmd run test:m6`: 16/16 Node tests and 3/3 M6 Playwright tests passed (exit 0).
- [ ] Server-enforced Admin authority and operations, production/staging verification, expired-session scenarios, and the listed demo integrations remain out of this local verification scope.

## Community correction status (2026-11-08)

- [x] Create Post controls use the existing CyberX form tokens and a scoped vertical grid; the desktop feed/composer grid has bounded columns and stacks at tablet/mobile widths.
- [x] Required title/category/content, 120/5,000-character limits, trimming, inline errors, disabled/loading state, safe text-only rendering, category badge, empty-feed state, and explicit local-demo success/failure feedback are implemented.
- [x] Unconfigured pages retain the explicit demo fallback. With the ignored local Supabase config present, posts/comments/likes use authenticated persistence and verified backend responses; author identity is server-derived.
- [x] Playwright layout checks pass at 1920, 1440, 1280, 1024, 768, 390, 375, and 320 CSS pixels. Screenshots are stored in `docs/testing/community-m7m8-screenshots/`.
