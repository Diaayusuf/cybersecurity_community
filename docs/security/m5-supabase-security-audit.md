# CyberX M5 — Supabase Security Audit

Audit date: 2026-11-07  
Repository: `C:\Users\Diaa\Documents\GitHub\cybersecurity_community`  
Branch: `feat/cyberx-complete-implementation`  
Project ref: `unxpmpgrvujijtfmyrfw`  
Audit mode: read-only against the connected Supabase project. The local migration remains unapplied.

## Executive summary

The connected project is active and healthy on PostgreSQL 17.6.1.166 in `ap-northeast-1`. `public.puzzle_players` is the only project relation found in the public schema. RLS is enabled and the intended public Hall of Fame read and anonymous insert policies exist. However, `anon` and `authenticated` currently have all table privileges on `puzzle_players`, including UPDATE, DELETE, and TRUNCATE. RLS has no UPDATE/DELETE policies, but it does not govern TRUNCATE. Public default ACLs also grant broad access for future `postgres`-owned tables, functions, and sequences.

The two existing rows were checked through aggregate counts only. Both satisfy the proposed constraints; no player values were returned. An existing unique functional index already enforces case-insensitive, trimmed-name uniqueness. The client was updated to select only contract fields. A local migration and read-only verification query are prepared but have not been applied or run against production.

## Methodology and scope

- Verified the canonical repository, branch, and Git status; inspected Supabase-related source, filenames, ignore rules, and project migration/config files.
- Queried current project metadata, RLS policies, role grants, constraints/indexes, default privileges, role attributes, Realtime publication membership, Storage metadata, migration history, extensions, Edge Functions, and security/performance/health advisors.
- Read catalog metadata and aggregate data-quality counts only. No names/domains or other player values were queried for display.
- Ran a value-redacted secret scan over tracked text. It emits only paths/categories, never matching values.
- No direct REST request, browser Supabase initialization, DML, DDL, deployment, credential rotation, or database configuration change was performed.

## Project and API configuration

| Item | Verified result |
|---|---|
| Status | ACTIVE_HEALTHY |
| PostgreSQL | 17.6.1.166; engine 17 |
| Region | ap-northeast-1 |
| Project migration history | No migrations listed |
| Edge Functions | None listed |
| Security advisor | Empty lint result |
| Performance advisor | Empty lint result |
| Health advisor | Empty lint result |
| Storage buckets | 0 |
| Installed extensions | pg_stat_statements, pgcrypto, plpgsql, supabase_vault, uuid-ossp |

The project API's configured exposed-schema list was not available through the connected project metadata tools. Catalog USAGE grants exist for `anon` and `authenticated` on `public`, `auth`, `extensions`, `graphql_public`, `realtime`, and `storage`; `vault` is not usable by those roles. Schema USAGE does not prove a schema is exposed through the Data API. The owner must confirm the actual API settings before migration approval.

## Tables, schema, and data contract

`public.puzzle_players` is an ordinary table owned by `postgres`. Its columns are `id uuid NOT NULL DEFAULT gen_random_uuid()`, `name text NOT NULL`, `domain text NULL`, and `created_at timestamptz NOT NULL DEFAULT now()`. It has a primary key on `id` and the unique index `lower(trim(name))`. It has no name/domain CHECK constraints, foreign keys, triggers, or additional indexes. No public views, project functions, or public triggers were found.

A catalog table summary reported 0 rows while a direct read-only aggregate query reported 2. The aggregate was used for the precheck; the discrepancy is retained as a verification note. That aggregate found zero blank/whitespace or over-limit names, zero domains incompatible with the current 40-character form limit, and zero normalized-name duplicate groups. Maximum stored name/domain lengths were 9 and 11. No actual values were returned.

The `storage` schema contains 10 Supabase-managed tables; all have RLS enabled, none has FORCE RLS, and there are no `storage` policies or buckets. Some managed Storage tables have table grants to API roles, but no policy currently grants row access. This app does not use Storage. These Supabase-managed relations are not changed.

The project also has platform-managed Auth and Realtime routines. `graphql_public.graphql` is security-invoker and executable by public API roles. Three Supabase Storage lifecycle SECURITY DEFINER functions are owned by `supabase_storage_admin`, have `search_path=pg_catalog`, and are not executable by anon/authenticated. No project-owned public SECURITY DEFINER routine was found. The exposed-schema setting and full platform-managed internal object configuration remain owner/platform verification items.

## RLS policies and effective permissions

RLS is enabled but not forced on `public.puzzle_players`.

| Policy | Role | Command | Expression | Effect |
|---|---|---|---|---|
| Anyone can view puzzle players | anon | SELECT | `USING (true)` | Public read of all rows is intentional for the Hall of Fame |
| Anyone can insert puzzle players | anon | INSERT | trimmed name length 1–40 | Anonymous insert; domain and generated columns are not checked here |

No authenticated policy or UPDATE/DELETE policy exists. The two policies have different commands and do not overlap. Any future permissive policy for the same command would combine using OR semantics.

Privilege checks show `anon` and `authenticated` currently have SELECT, INSERT, UPDATE, DELETE, and TRUNCATE at the table level. RLS blocks UPDATE/DELETE rows because no policy permits them; TRUNCATE is not subject to RLS. These are non-login runtime roles, so the excessive TRUNCATE grant requires a SQL execution path to exploit, but it is still unnecessary privilege. The database has no project-owned public RPC function.

Default ACLs in `public` for both `postgres` and `supabase_admin` include broad table/function/sequence grants to API roles. The prepared migration revokes these defaults only for future `postgres`-owned public objects and only for `anon`/`authenticated`. It leaves Supabase-managed `supabase_admin` defaults and `service_role` unchanged.

`service_role` has BYPASSRLS and full table privileges and must stay server-only. `anon` and `authenticated` are neither superusers nor BYPASSRLS roles. No service-role key use was found in browser code.

## Application Supabase usage

Only `puzzle.html` initializes Supabase. It loads `@supabase/supabase-js@2` from jsDelivr and uses the public publishable key.

| Flow | Before M5 | Local M5 change |
|---|---|---|
| Initial Hall of Fame | `select('*')`, ordered by created_at; uses id/name/domain/created_at | Explicit `id, name, domain, created_at` |
| Duplicate check | `select('id, name')` across all entries | `select('name')` only |
| Insert | Sends name/domain, then unrestricted `.select()` for returned row | Explicit `id, name, domain, created_at` return projection |
| Realtime | Subscribes to public INSERT on `puzzle_players` | Unchanged; publication membership is present |
| UPDATE/DELETE/RPC/Storage | None found in application | None added |

The browser form limits name and domain to 40 characters and trims them. Direct API calls bypass those checks. The existing functional unique index is the race-safe duplicate arbiter; the UI handles duplicate-key error `23505`. The browser submits only name/domain; existing database defaults generate id/time. Prior table-wide INSERT grants nonetheless allowed other direct clients to provide those generated columns; the migration changes INSERT to column-level grants.

Puzzle success remains client-side and the challenge material is browser-visible. An attacker can bypass the UI and create a leaderboard entry without proving a solve. This is not fixed by M5.

## Risk-ranked findings

| ID | Finding | Severity / confidence | Attack path and impact | Recommendation |
|---|---|---|---|---|
| M5-01 | Excessive table grants and public default ACLs | High / confirmed overprivilege; direct exploitability depends on SQL execution | Anon/auth have all table rights, including TRUNCATE; broad defaults can expose future postgres-owned public objects unless individually secured. | Apply the reviewed least-privilege migration only after staging validation and explicit production approval. |
| M5-02 | Missing database input constraints | Medium / confirmed | Direct API requests bypass form limits. Existing RLS checks only name length; domain has no DB bound and whitespace-only names can pass common trim semantics. | Add and validate DB constraints matching the 40-character UI contract; migration prepared. |
| M5-03 | Anonymous write abuse and unbounded reads | High / confirmed design limitation | Any caller with the public key can submit allowed records repeatedly; the page reads the full list and all names for duplicate checks. No rate limiter was verified. | M6 trusted submission boundary, abuse controls, and a bounded/paginated read strategy. RLS is not rate limiting. |
| M5-04 | Puzzle solve can be forged | High / confirmed design limitation | Client-side flag check can be bypassed; direct anon inserts do not prove a solve. | M6 server-side verification, anti-replay, and idempotency. |
| M5-05 | Data API exposed schemas unverified | Medium / configuration unknown | Database USAGE grants do not reveal the API exposed-schema list. | Owner verifies Dashboard API settings before production approval. |
| M5-06 | Public Hall of Fame and Realtime expose all current fields | Low / intended behavior | Public clients can read names/domains and receive INSERT events. | Confirm intended visibility; revisit if private columns or high volume are introduced. |
| M5-07 | Supabase JS loaded through major-version CDN alias | Low / confirmed | Upstream minor/patch runtime changes can be delivered without a source change. | Pin/bundle the dependency in a separately reviewed supply-chain change. |

No Critical finding was confirmed. Empty advisor results do not prove absence of vulnerabilities.

## Migration, verification, and remaining risks

Prepared local migration: `supabase/migrations/20261107124827_cyberx_puzzle_players_least_privilege.sql`. It adds two validated checks, tightens the anon INSERT policy, narrows table grants to public read plus name/domain insert, and reduces postgres-owned public default privileges. It does not transform/delete data or alter Storage, Auth, Realtime publication, service_role, or project configuration. See `docs/security/m5-migration-plan.md` for safety, impact, rollback, and approval steps.

Local verification completed: full Playwright suite passed twice (46/46 each run), including the new static Supabase query-contract test; `node --check` for that test and the inline puzzle script passed; `git diff --check` passed. No SQL parser/server was available, so the read-only SQL script was reviewed but not executed. Read-only query: `supabase/tests/m5-readonly-verification.sql`. Staging write tests are documented in `docs/testing/m5-supabase-verification.md`; none ran because no staging database is connected. The connected production project was not tested with direct REST writes, and post-migration compatibility is therefore unverified.

No local Supabase config or prior migrations existed. The migration is incremental, not a fabricated baseline. Confirm Data API schema settings and reconcile migration history before any push/apply.

M6 owns trusted puzzle validation, abuse/rate limiting, anti-replay/idempotency, and server-generated proof of solve. No such controls are claimed to exist.

## Secret hygiene

A value-redacted tracked-text scan found zero matches for service/secret-key patterns, database credential URLs, private-key blocks, or secret-token assignments. No tracked `.env` file exists. `.gitignore` ignores `.env` and `.env.*` while allowing `.env.example`. The browser publishable key is public configuration and is not repeated here. No credential was rotated.

## Production and Git safety

Supabase inspection consisted of read-only metadata/catalog queries and aggregate counts. No production rows, schema, grants, policies, project settings, or credentials changed. No production migration was applied and no deployment occurred. No commit, push, merge, reset, restore, or history rewrite occurred. Prior `admin.html`, `index.html`, P0/P1, and other worktree changes were preserved.