# CyberX M5 — Supabase Verification Guide

## Safety boundary

The connected Supabase project is treated as production. The migration and verification scripts are local preparation. Do not run staging write tests against production. No direct REST request or browser Supabase call was made in this audit.

## Verified current observations

- The connected project migration list is empty; there was no local Supabase config or previous migration folder.
- A read-only aggregate precheck returned 2 `puzzle_players` rows; no incompatible names/domains or normalized duplicates were found. No player values were printed.
- Security, performance, and health advisors returned empty lint lists.
- `puzzle_players` is in the `supabase_realtime` publication.
- The API exposed-schema settings were not available from the connected metadata tools; verify in Dashboard before production approval.

## Local checks

```powershell
node --check tests/supabase-contract.spec.mjs
npm.cmd test -- tests/supabase-contract.spec.mjs
npm.cmd test
```

Executed locally: `node --check tests/supabase-contract.spec.mjs` passed; the full Playwright suite passed twice (46/46 each run), including the static contract check. The `puzzle.html` inline script syntax check passed (1 script), and `git diff --check` passed. Admin Playwright sessions use synthetic records and block external requests; they do not initialize Supabase. The read-only SQL verification script was reviewed but not parsed or executed because no local PostgreSQL parser/server is installed; it must be run against the approved staging database after migration review.

After applying the reviewed migration to a disposable staging database, run `supabase/tests/m5-readonly-verification.sql`. It executes SELECTs only and returns structural booleans and aggregate counts, never player names/domains. Expected: every structural `passed` value is true; invalid name/domain counts are zero. This script has not been run against production.

## Required staging-only behavioral checks

Use a disposable project and synthetic names/domains. None of these writes has been executed here.

1. Anonymous SELECT reads the public four-column Hall of Fame contract.
2. Valid anonymous INSERT with name and optional domain succeeds; PostgreSQL generates `id` and `created_at`.
3. Blank/whitespace-only name, name over 40, blank non-NULL domain, and domain over 40 are rejected by PostgreSQL.
4. Anonymous INSERT specifying `id` or `created_at`, UPDATE, DELETE, and TRUNCATE are denied.
5. Authenticated has no table access unless a separately reviewed feature requires it.
6. Concurrent case/trim-equivalent names produce one successful insert and one unique violation from the existing index.
7. Valid INSERT arrives over the current Realtime subscription and renders in the Hall of Fame.
8. Network failure retains a usable error state. Do not infer rate limiting from this test.

Run write cases only in a disposable staging project; if that is unavailable, leave them unexecuted and report the blocker. Do not use production for constraint or API write tests.

## Unverified items

- Actual Data API exposed-schema configuration.
- Constraint and role behavior after migration in staging.
- Direct REST denials for UPDATE/DELETE/TRUNCATE and generated columns.
- Realtime authorization after the proposed grants.
- Rate limiting/abuse controls; none were verified.
- SQL parser/linter validation if a local PostgreSQL/Supabase test stack is unavailable.