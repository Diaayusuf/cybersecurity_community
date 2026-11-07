# CyberX M5 — Verified Permissions Matrix

Audit date: 2026-11-07. Read-only catalog inspection. Target permissions describe a local migration proposal only; it has not been applied.

## `public.puzzle_players`

| Role | Current SQL grants | Current effective RLS | Prepared target |
|---|---|---|---|
| `anon` | SELECT, INSERT, UPDATE, DELETE, TRUNCATE | SELECT all rows via `USING (true)`; INSERT requires trimmed name length 1–40; UPDATE/DELETE have no applicable policy; TRUNCATE is not governed by RLS | SELECT on `id,name,domain,created_at`; INSERT on `name,domain`; no UPDATE/DELETE/TRUNCATE; retain public-read policy and tighten insert validation |
| `authenticated` | SELECT, INSERT, UPDATE, DELETE, TRUNCATE | No applicable policies; row operations are denied by RLS | No table grants or policies; app has no authenticated Supabase flow |
| `service_role` | Full table privileges | BYPASSRLS | Unchanged; server-only |
| `postgres` owner | Owner privileges; BYPASSRLS | Owner can administer table | Unchanged |

`anon` and `authenticated` have `public` schema USAGE. Current table-level privileges imply all-column access. The proposed migration revokes all table rights from both roles, then grants only the necessary column-level access to `anon`. All four current columns remain publicly readable as the declared Hall of Fame contract.

## Policies

| Table/policy | Role | Command | Current expression | Proposed target |
|---|---|---|---|---|
| Anyone can view puzzle players | anon | SELECT | `USING (true)` | Unchanged |
| Anyone can insert puzzle players | anon | INSERT | Trimmed name length 1–40 | Non-whitespace name 1–40 and optional non-whitespace domain 1–40 |

There is no authenticated policy and no UPDATE or DELETE policy. Policies are permissive; policies for the same command combine with OR semantics.

## Defaults and other schemas

- Current `public` default ACLs for `postgres` and `supabase_admin` grant broad table, function, and sequence privileges to API roles.
- Proposed migration revokes future table/sequence/function default grants only for `anon`/`authenticated` on `postgres`-owned `public` objects. It leaves `service_role` and `supabase_admin` defaults unchanged.
- Ten Supabase-managed `storage` tables have RLS enabled and no policies. Some have API-role grants; there are no buckets and no CyberX Storage calls. No managed Storage objects are modified.
- Catalog schema USAGE does not establish the configured Data API exposed-schema list. Confirm that setting in Dashboard before migration approval.

## Related objects

- `id` and `created_at`: NOT NULL with database UUID/time defaults. `name`: NOT NULL. `domain`: nullable.
- Primary key: `id`.
- Existing unique functional index: `lower(trim(name))`; retained for case-insensitive trimmed-name uniqueness.
- No trigger, public project function, or view for `puzzle_players`.
- `graphql_public.graphql` is Supabase-managed, security-invoker, and executable by public API roles.
- Three Storage lifecycle SECURITY DEFINER functions use `search_path=pg_catalog` and are not executable by `anon`/`authenticated`.
- UUID ID means the app table has no sequence.

No production grants or policies were changed. The target column is an unapplied local proposal.