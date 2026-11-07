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
