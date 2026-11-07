# CyberX — Current Implementation Map

## Scope and status

This document reflects the current local implementation in the workspace as of 2026-11-07. It is a read-only architecture map for the existing static site, M5 hardening work, and M6 server-side puzzle validation logic. It does not claim production deployment or active remote database enforcement.

## Repository and branch

- Repository root: `C:\Users\Diaa\Documents\GitHub\cybersecurity_community`
- Branch: `feat/cyberx-complete-implementation`
- Working tree: existing local modifications preserved; no production migration, function deployment, or remote write was performed.

## Existing architecture

### Public application pages

- `index.html` — public landing experience and navigation shell
- `puzzle.html` — puzzle narrative, Hall of Fame, public leaderboard read, client submission flow
- `admin.html` — authenticated admin dashboard and protected admin data workflow
- `awareness.html` — awareness content page

### Client-side dependencies

- `style.css` and inline page styles provide the site theme and motion behavior.
- `script.js` provides non-puzzle site logic, including local behaviors and shared data handling.
- The puzzle page loads the Supabase JavaScript SDK from a CDN and reads the public leaderboard model through a Supabase client.
- The page does not contain the expected answer or trusted verification logic.

## Main application flows

### Public read flow

- Browser loads the public Hall of Fame from `public.puzzle_leaderboard`.
- Projection is explicit: `id, name, domain, created_at, verification_status`.
- Legacy rows are kept in `public.puzzle_players` and are displayed as `legacy_unverified`.
- New trusted solves are read from `public.puzzle_verified_solves` and labeled `server_verified`.

### Puzzle submission flow

1. Browser reads the public leaderboard view.
2. Browser validates the form field structure and sends JSON to the `submit-puzzle` Edge Function.
3. The function validates method, content-type, origin, payload schema, request size, and publishable API key.
4. It derives a trusted source fingerprint from the request source address and enforces a database-backed rate limit.
5. It reads the active challenge configuration from a server-side secret object.
6. It computes keyed HMAC digests for the candidate answer and configured answer.
7. It compares the fixed-length digests on the server and never exposes the answer or secrets to the browser.
8. It calls a service-role-only Postgres RPC to finalize the event.
9. The RPC records incorrect attempts and, only for correct answers, writes a verified solve record with a server timestamp.

### Leaderboard flow

- Public leaderboard is a `security_invoker` view: `public.puzzle_leaderboard`.
- The view combines legacy rows and verified rows under a common schema.
- `verification_status` is a text label rather than a trusted user-controlled score.
- Historical rows remain readable but remain visibly unverified.

## Database objects

### Public schema

- `public.puzzle_players`
  - Legacy table for historical Hall of Fame rows.
  - Remaining public read access.
  - New anonymous writes are removed by the M6 migration.
- `public.puzzle_verified_solves`
  - New verified evidence of puzzle completion.
  - Server-generated record with `challenge_id`, `name`, `domain`, and `verified_at`.
  - Per-challenge normalized-name uniqueness constraint prevents duplicate normalized names.
- `public.puzzle_leaderboard`
  - Security-invoker compatibility view exposing only the intended public fields.
  - Includes `legacy_unverified` and `server_verified` provenance labels.

### Private schema

- `private.puzzle_submission_rate_limits`
  - Short-lived keyed rate-limit counters.
  - Contains a source fingerprint and request count, not raw user identities or raw IP addresses.
- `private.puzzle_submission_idempotency`
  - Keyed replay and duplicate prevention state.
  - Stores request hashes and allowed outcomes without answer material.

## Edge Function dependencies

- `supabase/functions/submit-puzzle/index.ts`
  - Entrypoint for Deno Edge Function runtime.
- `supabase/functions/submit-puzzle/handler.mjs`
  - Core logic for input validation, secret checks, origin filtering, source-rate gating, answer verification, and RPC calls.

Expected runtime dependencies in a real staging environment:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEYS` or equivalent publishable key configuration
- `SUPABASE_SECRET_KEYS` or `SUPABASE_SERVICE_ROLE_KEY` for service-role RPC calls
- `CYBERX_ALLOWED_ORIGINS`
- `CYBERX_CHALLENGE_CONFIG_JSON`
- `CYBERX_ANSWER_HMAC_KEY`
- `CYBERX_RATE_LIMIT_HMAC_KEY`
- `CYBERX_IDEMPOTENCY_HMAC_KEY`

No secret values are committed to the repository.

## Security boundaries

- Browser is not trusted to decide correctness.
- Browser cannot submit a trusted verification flag, score, rank, or timestamp.
- Public API roles are limited to the intended read-only leaderboard model and, in M5, allowed legacy insert fields only.
- Service-role access remains server-side and is used by the submit function only.
- The M6 migration removes anonymous trusted writes and leaves historical rows readable but labeled unverified.

## Outstanding dependencies

The following remain external and unverified without a disposable staging environment:

1. Real Postgres execution of the M5 and M6 migrations
2. Supabase RLS/policy verification against a live database
3. Edge Function deployment and execution against a local or staging Supabase project
4. Realtime publication + subscription verification
5. Full remote configuration validation for allowed origins and secrets
6. Final production approval workflow

## Implementation summary

The local codebase already contains the necessary architecture for M5 and M6 security controls, and the checked-in tests assert the intended server-side behavior. The remaining gaps are operational verification against a live local or staging PostgreSQL/Supabase environment and a production approval process. No production changes were made in this workspace.
