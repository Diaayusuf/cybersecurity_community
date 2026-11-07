# CyberX migration plan

This is a staged proposal. Stop after the audit for review; no application migration is authorized by this document. Production Supabase and deployment remain untouched until reviewed, tested in a separate environment, and explicitly approved.

## Stage 0 — Review and contain urgent exposure

- Review this audit and confirm the intended implementation branch. The checkout is currently `main`; preserve the existing `admin.html` worktree edit.
- Treat the plaintext database-password-like string in `puzzle.html` as exposed. The audit cannot determine whether it is valid. An authorized owner should determine scope and rotate/revoke it through the appropriate provider if real; do not change production Supabase during this audit.
- Remove the credential/comment and puzzle-master solution notes from any future public bundle in a separately reviewed code change. If ever committed, removing them from the current file alone does not remove Git history exposure.
- Confirm the existing Supabase publishable key is the intended public key and inspect RLS/grants in a staging project, without querying or mutating production as part of this task.

## Stage 1 — Baseline and feature contract

- Record screenshots/manual acceptance steps for each page, module, terminal command, puzzle layer, Hall of Fame, admin workflow, and awareness interaction.
- Inventory all asset references and identify duplicates by content/visual inspection before pruning anything. Keep all current assets initially.
- Define data ownership, desired persistence, admin roles, moderation/privacy requirements, and whether admin localStorage remains a supported mode.
- Define the deployed public file allowlist and verify there is no accidental exposure of `notes.txt` or internal puzzle notes.

## Stage 2 — Security hardening of existing behavior

- Fix unsafe experience-feed rendering with `textContent` or context-correct escaping; add server-side validation before introducing persistence.
- Remove client-side-only admin password claims or replace the gate with a backend-authenticated identity/session while keeping the existing dashboard interface intact. No client-side credential can protect admin data.
- Add database-side unique normalized names, bounded fields, least-privilege grants/RLS, and server-side challenge validation as needed. Verify in staging with anonymous and authenticated roles.
- Reduce public Hall of Fame data to approved display fields, avoid full-table duplicate scans, and establish anti-abuse/rate controls.
- Remove sensitive comments/notes from the publish output; keep puzzle solutions in a controlled authoring source only if needed.

## Stage 3 — Explicit data migration

- Build export/backup and import adapters for the current admin localStorage media and puzzle JSON formats.
- Test import/export round trips against a staging schema, preserve IDs/content where feasible, and document recovery/rollback.
- Migrate user data only after the owner approves storage, authentication, and privacy behavior. Never point a development migration at production by default.

## Stage 4 — Refactor presentation incrementally

- Extract shared CyberX tokens and common layout into reusable CSS/assets; preserve per-page palette variations and pixel-level intent.
- Move inline JavaScript into page-scoped modules while retaining existing page entry points and interactions. Keep empty `script.js`/`style.css` compatibility decisions explicit.
- Replace inline handlers only where useful for accessibility and CSP. Introduce a restrictive CSP in report-only mode first, then enforce after inline code and external dependency requirements are addressed.
- Correct mojibake with verified UTF-8 conversion and visual review.
- Keep the Admin Dashboard product design and workflows; improve implementation behind its current interface.

## Stage 5 — Validation and deployment preparation

- Validate functional parity, keyboard/accessibility behavior, responsive layouts, safe-input handling, and Supabase policies against staging.
- Prepare a minimal Wasmer static-site configuration with explicit publication root, headers, route behavior, and an allowlist. Confirm source notes and secrets are excluded.
- Review production migration, rollback, monitoring, and release plan. Deploy only after a separate explicit approval.

## Rollback principles

Keep the existing static pages and exported local data available until the replacement path is proven. Version database changes as reversible migrations where possible, back up before approved production migration, and document a tested rollback path. Never assume an HTML rollback reverses database changes.
