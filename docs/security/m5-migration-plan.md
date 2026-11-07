# CyberX M5 — Migration Plan and Safety Review

## Prepared migration

**File:** `supabase/migrations/20261107124827_cyberx_puzzle_players_least_privilege.sql`  
**Status:** Local only; not applied to staging or production.

The Supabase CLI created this timestamped file. It is an incremental migration, not a baseline and not fabricated migration history.

## Database changes

1. Add and validate a name CHECK requiring at least one non-whitespace character and trimmed length 1–40.
2. Add and validate a domain CHECK allowing NULL; non-NULL values must contain a non-whitespace character and trimmed length 1–40, matching the current form.
3. Revoke all table privileges from `anon` and `authenticated`, including UPDATE, DELETE, TRUNCATE, REFERENCES, and TRIGGER.
4. Grant `anon` SELECT on the four current public columns and INSERT only on `name, domain`. This prevents API callers from specifying database-generated `id` or `created_at`.
5. Tighten the existing anon INSERT policy to match the database checks. Retain the public SELECT policy.
6. Revoke broad default table, sequence, and function grants for future `postgres`-owned `public` objects from `anon` and `authenticated`.

`service_role`, Supabase-managed `supabase_admin` defaults, schema usage, Realtime publication, Storage/Auth objects, and existing data are unchanged. No DML or data rewrite is included.

## Compatibility and safety

The current client sends only name/domain and requires id/name/domain/created_at for the public leaderboard and newly inserted row. `puzzle.html` now selects those four columns explicitly; the duplicate precheck selects only `name`. The migration grants match those projections and preserve the current anonymous Hall of Fame behavior. The normalized-name unique index is retained as the race-safe duplicate rule.

Read-only aggregate checks found 2 current rows and zero values incompatible with the proposed checks. If values change before a future apply and validation fails, the migration fails instead of rewriting rows. The domain is free-form descriptive text in the current UI, so no DNS-only restriction is added.

Adding constraints requires DDL locks; validation scans the table. The present table has two rows, but production lock timing must be assessed by the owner. Constraint creation is one-time; grants and default privilege revocations are repeatable. No migration has been run remotely.

The default ACL change affects only future objects created by `postgres` in `public`; it does not fix defaults for Supabase-managed `supabase_admin`. New objects still need RLS and explicit grants/policies. Future object creation may require application-specific grants, which is the intended deny-by-default behavior.

## Apply gates

Before any production apply:

1. Review the exact SQL and permissions impact.
2. Confirm Dashboard Data API exposed schemas and the anon client role.
3. Reconcile the empty remote migration history with the existing manually provisioned schema; do not create a fake baseline.
4. Apply to disposable staging and run `supabase/tests/m5-readonly-verification.sql`.
5. Test anonymous read/insert, generated id/time, invalid inputs, denied update/delete/truncate, uniqueness races, and Realtime delivery in staging.
6. Approve a separate production migration window only after staging passes.

## Rollback

If an owner-approved apply has a verified compatibility failure, prepare a separate rollback migration. It would drop the two checks, restore the original name-only insert policy, grant ALL table privileges back to anon/authenticated, and restore the previous postgres-owned public default grants on tables/sequences/functions. This rollback deliberately weakens security. It has not been run or staged.

If the migration remains unapplied, no remote rollback is needed.

## Production approval

This migration is local preparation only. No production schema, data, policy, grant, or migration history has changed.