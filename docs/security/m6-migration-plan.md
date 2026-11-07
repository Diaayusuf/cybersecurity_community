# CyberX M6 — Migration and Release Plan

**State:** Both migrations and the Edge Function are local only. No migration, secret, function, data, or configuration was changed in Supabase.

## Prepared migrations

| File | Purpose | Data impact |
|---|---|---|
| `supabase/migrations/20261107124827_cyberx_puzzle_players_least_privilege.sql` (M5) | Add form-matching checks, reduce legacy table grants, retain public reads and legacy inserts until M6 removes them. | Validates existing data; no row rewrite. |
| `supabase/migrations/20261107133243_cyberx_m6_trusted_puzzle_submissions.sql` | Add verified solves, private rate/idempotency tables, service-role-only RPCs, safe public compatibility view, realtime publication membership, and remove public writes to the legacy table. | Additive. Existing `puzzle_players` rows are preserved and labeled unverified. No puzzle flags or answer hashes are seeded. |

The current project metadata reports no recorded migrations and no Edge Functions. The M5 migration is only a local artifact. Reconcile migration history and API settings in the Supabase Dashboard before any push; do not mark files as applied or assume an empty migration list means the schema is empty.

## M6 database objects

- `public.puzzle_verified_solves`: RLS enabled, row-level public SELECT only, explicit column grants. No API-role insert/update/delete/truncate. New inserts happen within a restricted RPC.
- `private.puzzle_submission_rate_limits`: HMACed source fingerprint, 10-minute window, counter; raw IP is not stored. Old windows are pruned on a later request after 48 hours.
- `private.puzzle_submission_idempotency`: challenge-scoped HMAC key and request fingerprint, result category, optional solve ID. Rows older than 90 days are pruned on a later submission.
- `public.consume_puzzle_rate_limit(text)`: service-role-only function; atomically allows at most 8 requests per source fingerprint per fixed 10-minute window and returns a bounded retry interval.
- `public.commit_puzzle_submission(text,text,text,text,text,boolean)`: service-role-only transaction; validates inputs, handles key replay/conflict, and inserts a verified solve atomically. Name uniqueness is case/trim normalized within each challenge.
- `public.puzzle_leaderboard`: `security_invoker` view with explicit public fields and `legacy_unverified` / `server_verified` labels.
- `public.puzzle_players`: preserved; only anonymous public reads remain. The old INSERT policy and API-role write grants are removed.

No answer configuration is stored in a table. The Edge Function loads the active answer map from a server-side environment secret. The public table and view contain no answer material, raw source address, request hash, or idempotency hash.

## Staging gates

Use a disposable staging project, never the connected production project, for these steps:

1. Verify the exact project ref, database, Data API exposed schemas, current grants/policies, and migration history. Confirm public schema access and review any drift before proceeding.
2. Configure non-production secrets: `CYBERX_CHALLENGE_CONFIG_JSON`, `CYBERX_ANSWER_HMAC_KEY`, `CYBERX_RATE_LIMIT_HMAC_KEY`, `CYBERX_IDEMPOTENCY_HMAC_KEY`, `CYBERX_ALLOWED_ORIGINS`, and the platform service credential. Use a synthetic challenge answer in staging; never copy a production answer into fixtures.
3. Review and apply M5 to staging, then run `supabase/tests/m5-readonly-verification.sql` while the M5 anonymous insert contract is still in effect. Apply M6 next and run `supabase/tests/m6-readonly-verification.sql`. Confirm RLS, function owner/search path/execute grants, column-level view access, publication membership, and absence of anon/authenticated table writes.
4. Deploy `submit-puzzle` to staging and run valid/invalid request tests, concurrent duplicate tests, rate-limit tests, browser timeout/retry tests, and Realtime verification. Inspect logs for accidental answer, key, or address output.
5. Test old leaderboard rows render as `LEGACY · UNVERIFIED` and remain unchanged. Test new rows render as `SERVER VERIFIED` only after a successful function response.
6. Review rollback and user-facing maintenance timing. Do not run destructive tests against existing data.

The connected project’s Data API exposed-schema list was not available in prior metadata inspection. Owner verification is required.

## Production release sequence — separate explicit approval required

No production step below was performed. After staging passes and the owner approves a release window:

1. Confirm a recovery/export plan and current migration state. Reconcile the empty recorded migration list with the existing schema and local M5 baseline.
2. Provision production Edge secrets through the Dashboard secret manager. Enter the real answer configuration directly there; do not put it in Git, an example file, a report, browser storage, or a command transcript. Set only the actual CyberX HTTPS origin plus any explicitly approved test origin.
3. Deploy the Edge Function and verify it has the expected secret names without printing secret values.
4. Apply the reviewed M5 and M6 migrations in order through the owner-approved migration process.
5. Deploy the updated static frontend and verify leaderboard provenance labels, verified submission, failure states, and no anonymous table writes.
6. Monitor function/database errors, 429 volume, duplicate outcomes, and leaderboard growth. Monitoring/alerts are not configured by this local work.

Supabase CLI v3 changed database command targeting to local by default and requires explicit hosted targeting. Read the installed CLI’s current `--help` before any approved remote operation; do not assume a command reaches the intended project. The [Supabase changelog](https://supabase.com/changelog) describes this CLI breaking change.

## Rollback and recovery

There is no down migration that restores anonymous writes or deletes verified records. Before any staging/production apply, no remote rollback is needed. After a migration, prefer a forward repair migration. Keep the verified table, idempotency records, and public read view; do not drop data to roll back a function release. If the function is unhealthy, the frontend remains in a retryable error state. Rolling back the static page to an older version will not restore direct inserts after M6 revokes them, and that restriction must not be reversed as a rollback shortcut.

If migration application fails, stop and inspect transaction state, migration history, and schema. The migration uses a transaction and contains no DML against historical rows. Never reset migration history or mark an unapplied file as applied. A change to old grants or function boundaries needs a separately reviewed migration.

## Local rollback status

The only work performed is repository-local file creation/editing. No production or staging rollback is required. The local migration has not been executed against PostgreSQL.